import Anthropic from "@anthropic-ai/sdk";
import { domainsInText, publicDomain } from "./domains";
import { runPhase, type Hook, type LookupResult, type Phase, type RunState, type ToolCall, type TraceEntry } from "./hooks";
import type { Lookups } from "./lookups";
import type { ModelClient } from "./model";
import { defaultHooks, lookupTarget, VERDICT_TOOL } from "./policies";
import { nudge, systemPrompt, wrapForwarded } from "./prompt";
import { tools } from "./tools";
import type { VerdictSubmission } from "./vocabulary";

export interface ImageInput {
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  /** Base64-encoded image bytes. */
  data: string;
}

export interface CheckInput {
  text?: string;
  images: ImageInput[];
}

/**
 * One line of a run's trace. It never holds message text: only what the
 * harness did and decided, so traces can outlive the 30-day content window.
 */
export type TraceEvent =
  | ({ kind: "hook" } & TraceEntry)
  | { kind: "model"; turn: number; stopReason: string | null; model: string; inputTokens: number; outputTokens: number }
  | { kind: "tool"; name: string; target: string | null; result: LookupResult }
  | { kind: "nudge" }
  | { kind: "end"; status: "done" | "failed"; detail: string };

export type CheckOutcome =
  | { status: "done"; verdict: VerdictSubmission; trace: TraceEvent[]; tokens: number; turns: number }
  | { status: "failed"; reason: string; trace: TraceEvent[]; tokens: number; turns: number };

export interface LoopDeps {
  model: ModelClient;
  lookups: Lookups;
  hooks?: typeof defaultHooks;
  now?: Date;
}

/**
 * The agent loop, written by hand. Each turn:
 *
 *   preModel hooks → model call → for each tool call:
 *     preTool hooks → (lookup → postTool hooks) or (submit_verdict → preSend hooks)
 *
 * It ends when a verdict passes preSend, or fails when a hook blocks a model
 * call (caps), the model refuses or errors, or it twice ends without a
 * verdict. A failed run gets an honest "couldn't check" reply, never a
 * made-up verdict.
 */
export async function runCheck(input: CheckInput, deps: LoopDeps): Promise<CheckOutcome> {
  const hooks = deps.hooks ?? defaultHooks;
  const state: RunState = {
    now: deps.now ?? new Date(),
    turns: 0,
    tokens: 0,
    lookupsMade: 0,
    textDomains: domainsInText(input.text ?? ""),
    hasImages: input.images.length > 0,
    lookupResults: [],
  };
  const trace: TraceEvent[] = [];
  const phase = async <T>(name: Phase, list: readonly Hook<T>[], value: T) => {
    const entries: TraceEntry[] = [];
    const result = await runPhase(name, list, state, value, entries);
    trace.push(...entries.map((e) => ({ kind: "hook" as const, ...e })));
    return result;
  };
  const finish = (outcome: { status: "done"; verdict: VerdictSubmission } | { status: "failed"; reason: string }): CheckOutcome => {
    trace.push({ kind: "end", status: outcome.status, detail: outcome.status === "done" ? outcome.verdict.verdict : outcome.reason });
    return { ...outcome, trace, tokens: state.tokens, turns: state.turns };
  };

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        ...input.images.map((img) => ({
          type: "image" as const,
          source: { type: "base64" as const, media_type: img.mediaType, data: img.data },
        })),
        { type: "text" as const, text: wrapForwarded(input.text, input.images.length) },
      ],
    },
  ];
  let nudged = false;

  for (;;) {
    const allowed = await phase("preModel", hooks.preModel, null);
    if (!allowed.ok) return finish({ status: "failed", reason: allowed.reason });

    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await deps.model.create({ system: systemPrompt, messages, tools });
    } catch (error) {
      const reason = error instanceof Anthropic.APIError ? `model error ${error.status ?? ""}`.trim() : "model unreachable";
      return finish({ status: "failed", reason });
    }
    state.turns += 1;
    // Cached prompt tokens are reported separately; they still count towards the cap.
    const usage = response.usage;
    const inputTokens = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    state.tokens += inputTokens + usage.output_tokens;
    trace.push({
      kind: "model",
      turn: state.turns,
      stopReason: response.stop_reason,
      model: response.model,
      inputTokens,
      outputTokens: usage.output_tokens,
    });
    if (response.stop_reason === "refusal") return finish({ status: "failed", reason: "model refused" });

    messages.push({ role: "assistant", content: response.content });
    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");

    if (toolUses.length === 0) {
      if (nudged) return finish({ status: "failed", reason: "no verdict after a nudge" });
      nudged = true;
      trace.push({ kind: "nudge" });
      messages.push({ role: "user", content: nudge });
      continue;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const call: ToolCall = { name: use.name, input: (use.input ?? {}) as Record<string, unknown> };
      const error = (text: string) => results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: text });

      const pre = await phase("preTool", hooks.preTool, call);
      if (!pre.ok) {
        error(`Blocked: ${pre.reason}.`);
        continue;
      }

      if (call.name === VERDICT_TOOL) {
        const send = await phase("preSend", hooks.preSend, call.input as unknown as VerdictSubmission);
        if (send.ok) return finish({ status: "done", verdict: send.value });
        error(`Rejected: ${send.reason}. Fix it and call submit_verdict again.`);
        continue;
      }

      const target = lookupTarget(call)!;
      state.lookupsMade += 1;
      const raw =
        call.name === "check_domain_age"
          ? await deps.lookups.domainAge(publicDomain(target)!, state.now)
          : await deps.lookups.urlReputation(target);
      const post = await phase("postTool", hooks.postTool, raw);
      const result = post.ok ? post.value : raw;
      state.lookupResults.push(result);
      trace.push({ kind: "tool", name: call.name, target: publicDomain(target), result });
      results.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: results });
  }
}

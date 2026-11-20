import type { DomainAgeResult, UrlReputationResult } from "./lookups";

/**
 * The hook layer. Four phases wrap every step of the agent loop:
 *
 *   preModel  before each model call     (turn and token caps)
 *   preTool   before each tool runs      (domain policy, lookup cap)
 *   postTool  after a tool returns       (strip results to known fields)
 *   preSend   before a verdict is used   (schema check, "looks genuine" guard)
 *
 * A hook looks at the context and the value passing through and returns one
 * decision: allow (optionally with a note), block with a reason, or replace
 * the value with a reason. Hooks in a phase run in order; the first block
 * stops the phase, and a replacement is what later hooks see. Every
 * decision is written to the trace, so a run can be read back step by step.
 */
export type Phase = "preModel" | "preTool" | "postTool" | "preSend";

export type Decision<T> =
  | { action: "allow"; note?: string }
  | { action: "block"; reason: string }
  | { action: "replace"; value: T; reason: string };

export interface Hook<T> {
  name: string;
  run(state: RunState, value: T): Decision<T> | Promise<Decision<T>>;
}

/** What the hooks can see about the run so far. The loop keeps it up to date. */
export interface RunState {
  now: Date;
  /** Model calls made so far. */
  turns: number;
  /** Input plus output tokens used so far. */
  tokens: number;
  /** Lookups actually run so far. */
  lookupsMade: number;
  /** Public domains code found in the forwarded text. */
  textDomains: string[];
  /** Whether the forwarded batch includes images, which only the model can read. */
  hasImages: boolean;
  /** Every lookup result returned in this run. */
  lookupResults: LookupResult[];
}

export type LookupResult = DomainAgeResult | UrlReputationResult;

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface TraceEntry {
  phase: Phase;
  hook: string;
  action: Decision<unknown>["action"];
  detail?: string;
}

export type PhaseResult<T> = { ok: true; value: T } | { ok: false; hook: string; reason: string };

/** Runs one phase's hooks over a value, recording each decision. */
export async function runPhase<T>(
  phase: Phase,
  hooks: readonly Hook<T>[],
  state: RunState,
  value: T,
  trace: TraceEntry[],
): Promise<PhaseResult<T>> {
  let current = value;
  for (const hook of hooks) {
    const decision = await hook.run(state, current);
    if (decision.action === "block") {
      trace.push({ phase, hook: hook.name, action: "block", detail: decision.reason });
      return { ok: false, hook: hook.name, reason: decision.reason };
    }
    if (decision.action === "replace") {
      trace.push({ phase, hook: hook.name, action: "replace", detail: decision.reason });
      current = decision.value;
    } else {
      trace.push({ phase, hook: hook.name, action: "allow", ...(decision.note ? { detail: decision.note } : {}) });
    }
  }
  return { ok: true, value: current };
}

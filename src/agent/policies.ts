import { publicDomain } from "./domains";
import type { Hook, LookupResult, ToolCall } from "./hooks";
import {
  nextSteps,
  organisations,
  signals,
  verdicts,
  type VerdictSubmission,
} from "./vocabulary";

/** Caps for one check, from the plan: 6 model turns, about 30k tokens, 5 lookups. */
export const runLimits = { maxTurns: 6, maxTokens: 30_000, maxLookups: 5, youngDomainDays: 30 } as const;

export const LOOKUP_TOOLS = ["check_domain_age", "check_url_reputation"] as const;
export const VERDICT_TOOL = "submit_verdict";

// --- preModel -------------------------------------------------------------

export const turnCap: Hook<null> = {
  name: "turn_cap",
  run: (s) =>
    s.turns >= runLimits.maxTurns
      ? { action: "block", reason: `turn cap reached (${runLimits.maxTurns})` }
      : { action: "allow" },
};

export const tokenCap: Hook<null> = {
  name: "token_cap",
  run: (s) =>
    s.tokens >= runLimits.maxTokens
      ? { action: "block", reason: `token cap reached (${s.tokens}/${runLimits.maxTokens})` }
      : { action: "allow" },
};

// --- preTool --------------------------------------------------------------

export const knownTool: Hook<ToolCall> = {
  name: "known_tool",
  run: (_s, call) =>
    [...LOOKUP_TOOLS, VERDICT_TOOL].includes(call.name as never)
      ? { action: "allow" }
      : { action: "block", reason: `unknown tool "${call.name}"` },
};

/**
 * Lookups only for real public domains that came from the forwarded message.
 * For text, code checks the domain appears in it. For images only the model
 * can read the link, so a domain not in the text is allowed and noted as
 * read from an image. Either way the lookup never visits the site.
 */
export const lookupDomainPolicy: Hook<ToolCall> = {
  name: "lookup_domain_policy",
  run: (s, call) => {
    if (!isLookup(call)) return { action: "allow" };
    const target = lookupTarget(call);
    const domain = target ? publicDomain(target) : null;
    if (!domain) return { action: "block", reason: "not a public internet domain" };
    if (s.textDomains.includes(domain)) return { action: "allow", note: `${domain} (in text)` };
    if (s.hasImages) return { action: "allow", note: `${domain} (from_image)` };
    return { action: "block", reason: `${domain} does not appear in the forwarded message` };
  },
};

export const lookupCap: Hook<ToolCall> = {
  name: "lookup_cap",
  run: (s, call) =>
    isLookup(call) && s.lookupsMade >= runLimits.maxLookups
      ? { action: "block", reason: `lookup cap reached (${runLimits.maxLookups})` }
      : { action: "allow" },
};

// --- postTool -------------------------------------------------------------

/** Only known fields, of known types, reach the model. */
export const resultWhitelist: Hook<LookupResult> = {
  name: "result_whitelist",
  run: (_s, r) => {
    const clean: LookupResult =
      "ageDays" in r
        ? {
            domain: short(r.domain),
            status: r.status,
            registered: r.registered ? short(r.registered) : null,
            ageDays: typeof r.ageDays === "number" ? r.ageDays : null,
          }
        : {
            domain: short(r.domain),
            status: r.status,
            threats: r.threats.map(short).slice(0, 4),
          };
    return JSON.stringify(clean) === JSON.stringify(r)
      ? { action: "allow" }
      : { action: "replace", value: clean, reason: "dropped unknown fields" };
  },
};

// --- preSend --------------------------------------------------------------

/**
 * The submission must use the fixed vocabulary, and a scam or suspicious
 * verdict must say why. A block here goes back to the model as an error so
 * it can resubmit, within the turn cap.
 */
export const validVerdict: Hook<VerdictSubmission> = {
  name: "valid_verdict",
  run: (_s, v) => {
    if (!verdicts.includes(v.verdict)) return { action: "block", reason: `unknown verdict "${v.verdict}"` };
    if (!Array.isArray(v.signals) || v.signals.some((x) => !signals.includes(x))) {
      return { action: "block", reason: "signals must come from the signal list" };
    }
    if (!organisations.includes(v.impersonating)) return { action: "block", reason: "unknown organisation" };
    if (!nextSteps.includes(v.next_step)) return { action: "block", reason: "unknown next step" };
    if (v.verdict !== "looks_genuine" && v.signals.length === 0) {
      return { action: "block", reason: `"${v.verdict}" needs at least one signal to explain it` };
    }
    return { action: "allow" };
  },
};

/**
 * "Looks genuine" is downgraded to "suspicious" when the model's own signals
 * or the lookups disagree with it. This doesn't prove a message is genuine;
 * it stops the model contradicting its own evidence, which is what an
 * injected message would aim for.
 */
export const genuineGuard: Hook<VerdictSubmission> = {
  name: "genuine_guard",
  run: (s, v) => {
    if (v.verdict !== "looks_genuine") return { action: "allow" };
    const reasons: string[] = [];
    if (v.signals.length > 0) reasons.push(`signals flagged: ${v.signals.join(", ")}`);
    for (const r of s.lookupResults) {
      if ("threats" in r && r.status === "flagged") reasons.push(`${r.domain} flagged by Safe Browsing`);
      if ("ageDays" in r && r.ageDays !== null && r.ageDays < runLimits.youngDomainDays) {
        reasons.push(`${r.domain} registered ${r.ageDays} days ago`);
      }
    }
    if (reasons.length === 0) return { action: "allow" };
    return {
      action: "replace",
      value: {
        ...v,
        verdict: "suspicious",
        next_step: v.next_step === "none" ? "contact_through_official_channel" : v.next_step,
      },
      reason: `downgraded to suspicious: ${reasons.join("; ")}`,
    };
  },
};

/** The hooks a check runs with, phase by phase, in order. */
export const defaultHooks = {
  preModel: [turnCap, tokenCap],
  preTool: [knownTool, lookupDomainPolicy, lookupCap],
  postTool: [resultWhitelist],
  preSend: [validVerdict, genuineGuard],
};

export function isLookup(call: ToolCall): boolean {
  return LOOKUP_TOOLS.includes(call.name as never);
}

export function lookupTarget(call: ToolCall): string | null {
  const v = call.name === "check_domain_age" ? call.input.domain : call.input.url;
  return typeof v === "string" ? v : null;
}

function short(s: string): string {
  return String(s).slice(0, 120);
}


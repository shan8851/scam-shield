import { domainsInText, refang } from "../src/agent/domains";
import type { CheckOutcome } from "../src/agent/loop";
import type { Verdict } from "../src/agent/vocabulary";
import type { EvalCase } from "./types";

/**
 * Deterministic scoring, no LLM judge. A missed scam costs far more than a
 * false alarm, so the cost table is lopsided on purpose. A failed check
 * ("couldn't check this one") costs like a cautious verdict.
 */
type Said = Verdict | "failed";

export const cost: Record<EvalCase["label"], Record<Said, number>> = {
  scam: { likely_scam: 0, suspicious: 2, looks_genuine: 10, failed: 2 },
  suspicious: { likely_scam: 0.5, suspicious: 0, looks_genuine: 3, failed: 0.5 },
  genuine: { likely_scam: 3, suspicious: 1, looks_genuine: 0, failed: 1 },
};

/** A next step outside the case's acceptable list. */
export const NEXT_STEP_COST = 0.5;

/** Each signal the case lists as wrong for it: the reply would say something untrue. */
export const WRONG_SIGNAL_COST = 0.5;

export const passBar = { maxAverageCost: 0.5, maxFalseAlarmRate: 0.2 } as const;

export interface CaseResult {
  id: string;
  label: EvalCase["label"];
  said: Said;
  cost: number;
  /** Reasons this case fails the whole run, whatever the score. */
  hardFailures: string[];
  holdout: boolean;
  retried: boolean;
  turns: number;
  tokens: number;
}

export function scoreCase(c: EvalCase, outcome: CheckOutcome, reply: string): Omit<CaseResult, "retried"> {
  const said: Said = outcome.status === "done" ? outcome.verdict.verdict : "failed";
  let total = cost[c.label][said];
  if (outcome.status === "done" && c.acceptableNextSteps && !c.acceptableNextSteps.includes(outcome.verdict.next_step)) {
    total += NEXT_STEP_COST;
  }
  if (outcome.status === "done" && c.wrongSignals) {
    total += outcome.verdict.signals.filter((s) => c.wrongSignals!.includes(s)).length * WRONG_SIGNAL_COST;
  }

  const hardFailures: string[] = [];
  if (c.label === "scam" && said === "looks_genuine") hardFailures.push("a scam was called genuine");
  if (c.gate && cost[c.label][said] > 0) hardFailures.push(`${c.gate} case got the wrong verdict (${said})`);

  // The reply must never echo anything from the message: check every domain
  // the case mentions, in its text or its recorded lookups.
  const domains = new Set([
    ...domainsInText(refang(c.text ?? "")),
    ...Object.keys(c.lookups?.domainAge ?? {}),
    ...Object.keys(c.lookups?.urlReputation ?? {}),
  ]);
  for (const d of domains) if (reply.toLowerCase().includes(d)) hardFailures.push(`reply echoed ${d}`);

  return { id: c.id, label: c.label, said, cost: total, hardFailures, holdout: !!c.holdout, turns: outcome.turns, tokens: outcome.tokens };
}

export interface Summary {
  cases: number;
  averageCost: number;
  falseAlarmRate: number;
  genuineCases: number;
  hardFailures: string[];
  pass: boolean;
}

export function summarise(results: CaseResult[]): Summary {
  const genuine = results.filter((r) => r.label === "genuine");
  const falseAlarms = genuine.filter((r) => r.said !== "looks_genuine").length;
  const averageCost = results.length ? results.reduce((s, r) => s + r.cost, 0) / results.length : 0;
  const falseAlarmRate = genuine.length ? falseAlarms / genuine.length : 0;
  const hardFailures = results.flatMap((r) => r.hardFailures.map((f) => `${r.holdout ? "(holdout case)" : r.id}: ${f}`));
  return {
    cases: results.length,
    averageCost,
    falseAlarmRate,
    genuineCases: genuine.length,
    hardFailures,
    pass: hardFailures.length === 0 && averageCost <= passBar.maxAverageCost && falseAlarmRate <= passBar.maxFalseAlarmRate,
  };
}

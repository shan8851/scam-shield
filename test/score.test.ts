import { describe, expect, it } from "vitest";
import type { CheckOutcome } from "../src/agent/loop";
import type { VerdictSubmission } from "../src/agent/vocabulary";
import { scoreCase, summarise, type CaseResult } from "../evals/score";
import type { EvalCase } from "../evals/types";
import { cases } from "../evals/cases";

const base: EvalCase = { id: "c", title: "t", category: "delivery", source: "constructed", label: "scam", text: "pay at hxxps://fees-uk[.]com" };
const done = (v: Partial<VerdictSubmission>): CheckOutcome => ({
  status: "done",
  verdict: { verdict: "likely_scam", signals: ["urgency"], impersonating: "none", next_step: "dont_reply", ...v },
  trace: [],
  tokens: 100,
  turns: 1,
});

describe("scoring a case", () => {
  it("costs a missed scam far more than a false alarm", () => {
    expect(scoreCase(base, done({ verdict: "looks_genuine" }), "").cost).toBe(10);
    expect(scoreCase({ ...base, label: "genuine" }, done({}), "").cost).toBe(3);
  });

  it("makes calling a scam genuine a hard failure", () => {
    expect(scoreCase(base, done({ verdict: "looks_genuine" }), "").hardFailures).toContain("a scam was called genuine");
  });

  it("makes any miss on a gated case a hard failure", () => {
    expect(scoreCase({ ...base, gate: "multi_image" }, done({ verdict: "suspicious" }), "").hardFailures).toHaveLength(1);
  });

  it("fails a reply that echoes a domain from the message", () => {
    expect(scoreCase(base, done({}), "Don't visit fees-uk.com").hardFailures).toContain("reply echoed fees-uk.com");
  });

  it("adds a small cost for a next step outside the acceptable list", () => {
    expect(scoreCase({ ...base, acceptableNextSteps: ["forward_to_7726_and_delete"] }, done({}), "").cost).toBe(0.5);
  });

  it("scores a failed check like a cautious verdict", () => {
    const failed: CheckOutcome = { status: "failed", reason: "x", trace: [], tokens: 0, turns: 1 };
    expect(scoreCase(base, failed, "").cost).toBe(2);
  });
});

describe("summarising a run", () => {
  const r = (label: CaseResult["label"], said: CaseResult["said"], cost: number): CaseResult => ({
    id: `${label}-${said}`, label, said, cost, hardFailures: [], holdout: false, retried: false, turns: 1, tokens: 1,
  });

  it("passes when cost and false alarms are under the bar", () => {
    expect(summarise([r("scam", "likely_scam", 0), r("genuine", "looks_genuine", 0)]).pass).toBe(true);
  });

  it("fails on too many false alarms even when cost is low", () => {
    const results = [r("genuine", "suspicious", 1), ...Array.from({ length: 3 }, () => r("scam", "likely_scam", 0))];
    expect(summarise(results)).toMatchObject({ falseAlarmRate: 1, pass: false });
  });
});

describe("the case set", () => {
  it("has unique ids, and every gated case is labelled scam", () => {
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases.filter((c) => c.gate)) expect(c.label).toBe("scam");
  });

  it("keeps scam links defanged in the files", () => {
    for (const c of cases.filter((c) => c.label !== "genuine")) {
      expect(JSON.stringify(c)).not.toMatch(/https?:\/\/(?!calendly\.com|telegram\.me)[^"\s]*\.(com|uk|ai|xyz)/);
    }
  });
});

import { appendFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fakeLookups } from "../src/agent/lookups";
import { runCheck } from "../src/agent/loop";
import { anthropicModel } from "../src/agent/model";
import { renderReply } from "../src/replies/render";
import { cases } from "./cases";
import { inputFor } from "./input";
import { passBar, scoreCase, summarise, type CaseResult, type Summary } from "./score";
import type { EvalCase } from "./types";

/**
 * Runs every case through the real agent loop and model, with recorded
 * lookups, and scores the verdicts. A case that misses is retried once,
 * because model output varies; the better of the two counts.
 *
 * Holdout cases are scored but only reported in aggregate, so prompt changes
 * can't be fitted to them. Exits non-zero if either group fails the bar.
 */
try {
  process.loadEnvFile(".env");
} catch {
  // CI provides the key in the environment.
}

const { values } = parseArgs({ options: { only: { type: "string" }, concurrency: { type: "string", default: "4" } } });
const selected = values.only ? cases.filter((c) => c.id === values.only) : cases;
if (selected.length === 0) throw new Error(`No case "${values.only}"`);

const model = anthropicModel();
async function runOnce(c: EvalCase) {
  const outcome = await runCheck(inputFor(c), { model, lookups: fakeLookups(c.lookups ?? {}) });
  return { ...scoreCase(c, outcome, renderReply(outcome)), outcome };
}

async function runCase(c: EvalCase): Promise<CaseResult & { verdict: string }> {
  let first = await runOnce(c);
  let retried = false;
  if (first.cost > 0 || first.hardFailures.length > 0) {
    retried = true;
    const second = await runOnce(c);
    if (second.cost < first.cost || second.hardFailures.length < first.hardFailures.length) first = second;
  }
  const verdict = first.outcome.status === "done" ? JSON.stringify(first.outcome.verdict) : `failed: ${first.outcome.reason}`;
  return { ...first, retried, verdict };
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

const results = await pool(selected, Number(values.concurrency), runCase);
const visible = results.filter((r) => !r.holdout);
const holdout = results.filter((r) => r.holdout);

const lines: string[] = [];
const log = (s = "") => lines.push(s);
log("| Case | Label | Said | Cost | Notes |");
log("|---|---|---|---|---|");
for (const r of visible) {
  const notes = [...r.hardFailures, r.retried ? "retried" : ""].filter(Boolean).join("; ");
  log(`| ${r.id} | ${r.label} | ${r.said} | ${r.cost} | ${notes} |`);
}
const describe = (name: string, s: Summary) =>
  `**${name}:** ${s.pass ? "PASS" : "FAIL"} · ${s.cases} cases · average cost ${s.averageCost.toFixed(2)} (bar ${passBar.maxAverageCost}) · false alarms ${(s.falseAlarmRate * 100).toFixed(0)}% of ${s.genuineCases} genuine (bar ${passBar.maxFalseAlarmRate * 100}%) · hard failures ${s.hardFailures.length}`;
const visibleSummary = summarise(visible);
const holdoutSummary = summarise(holdout);
log();
log(describe("Visible", visibleSummary));
if (holdout.length) log(describe("Holdout", holdoutSummary));
for (const f of [...visibleSummary.hardFailures, ...holdoutSummary.hardFailures]) log(`- hard failure: ${f}`);
log(`\nTokens: ${results.reduce((s, r) => s + r.tokens, 0)} across ${results.length} cases`);

const report = lines.join("\n");
console.log(report);
if (values.only) for (const r of visible) console.log(`\n${r.id}: ${r.verdict}`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Eval\n\n${report}\n`);

process.exit(visibleSummary.pass && (holdout.length === 0 || holdoutSummary.pass) ? 0 : 1);

import type { LookupResult } from "../agent/hooks.js";
import type { CheckOutcome } from "../agent/loop.js";
import type { VerdictSubmission } from "../agent/vocabulary.js";
import {
  fixedReplies,
  footer,
  genuineReason,
  hmrcReportLine,
  lookupFact,
  maxSignalLines,
  nextStepLine,
  officialChannel,
  organisationName,
  signalLine,
  signalPriority,
  verdictHeader,
  whatToDoLabel,
} from "./copy.js";

/**
 * Turns a finished check into the message the person receives. Only enums
 * and lookup numbers go in; every word comes from `copy.ts`.
 */
export function renderReply(outcome: CheckOutcome): string {
  if (outcome.status === "failed") return fixedReplies.checkFailed;
  const lookups = outcome.trace.flatMap((e) => (e.kind === "tool" ? [e.result] : []));
  return renderVerdict(outcome.verdict, lookups);
}

export function renderVerdict(verdict: VerdictSubmission, lookups: LookupResult[]): string {
  const parts: string[] = [verdictHeader[verdict.verdict]];

  if (verdict.verdict === "looks_genuine") {
    parts.push(lookups.length > 0 ? genuineReason.withLinks : genuineReason.noLinks);
  } else {
    const reasons = [...signalLines(verdict), ...lookupFacts(lookups)];
    parts.push(reasons.map((r) => `• ${r}`).join("\n"));
  }

  const next = nextStep(verdict);
  if (next) parts.push(`${whatToDoLabel} ${next}`);

  parts.push(footer);
  return parts.join("\n\n");
}

function signalLines(verdict: VerdictSubmission): string[] {
  return signalPriority
    .filter((s) => verdict.signals.includes(s))
    .slice(0, maxSignalLines)
    .map((s) => signalLine[s].replace("{org}", organisationName[verdict.impersonating]));
}

/** Only facts that count against the message; a clean result is never mentioned. */
function lookupFacts(lookups: LookupResult[]): string[] {
  const facts = new Set<string>();
  for (const r of lookups) {
    if ("threats" in r && r.status === "flagged") facts.add(lookupFact.flagged);
    if ("ageDays" in r && r.status === "not_found") facts.add(lookupFact.domainNotFound);
    if ("ageDays" in r && r.ageDays !== null && r.ageDays < 30) facts.add(lookupFact.youngDomain(r.ageDays));
  }
  return [...facts].slice(0, 2);
}

function nextStep(verdict: VerdictSubmission): string | null {
  switch (verdict.next_step) {
    case "none":
      return null;
    case "contact_through_official_channel":
      return officialChannel[verdict.impersonating];
    case "forward_to_7726_and_delete":
      return verdict.impersonating === "hmrc" ? hmrcReportLine : nextStepLine.forward_to_7726_and_delete;
    default:
      return nextStepLine[verdict.next_step];
  }
}

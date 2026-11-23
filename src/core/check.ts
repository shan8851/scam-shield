import { eq } from "drizzle-orm";
import { runCheck, type CheckInput, type CheckOutcome, type LoopDeps } from "../agent/loop.js";
import type { Db } from "../db/client.js";
import { checks } from "../db/schema.js";
import { audit } from "./audit.js";

/**
 * Runs the agent for a check the gate admitted, then records the outcome and
 * trace on the check row and in the audit log. The audit entry holds only
 * the verdict or the failure reason.
 */
export async function runAdmittedCheck(
  db: Db,
  check: { id: string; senderId: string },
  input: CheckInput,
  deps: LoopDeps,
): Promise<CheckOutcome> {
  const outcome = await runCheck(input, deps);
  const finishedAt = deps.now ?? new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(checks)
      .set({
        status: outcome.status,
        finishedAt,
        verdict: outcome.status === "done" ? { ...outcome.verdict } : null,
        failure: outcome.status === "failed" ? outcome.reason : null,
        trace: outcome.trace,
        tokens: outcome.tokens,
      })
      .where(eq(checks.id, check.id));
    await audit(
      tx,
      outcome.status === "done" ? "check_done" : "check_failed",
      check.senderId,
      outcome.status === "done"
        ? { checkId: check.id, verdict: outcome.verdict.verdict, turns: outcome.turns, tokens: outcome.tokens }
        : { checkId: check.id, reason: outcome.reason, turns: outcome.turns, tokens: outcome.tokens },
      finishedAt,
    );
  });
  return outcome;
}

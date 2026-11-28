import { and, eq, lt } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { checks, messages, senders } from "../db/schema.js";
import { audit } from "./audit.js";

export const RETENTION_DAYS = 30;

/**
 * The daily retention job. Forwarded messages (their text and image
 * references) are deleted after 30 days, and a pending sender's name,
 * username and chat ID are cleared if no one has decided on them in that
 * time. Checks, verdicts, traces and the audit log are kept: none of them
 * hold message text.
 *
 * It also sweeps up checks still "running" long after any function could
 * be (one killed mid-check by the platform), marking them failed so they
 * show in /status and the failure alert.
 */
export const STALE_CHECK_MINUTES = 10;

export async function applyRetention(
  db: Db,
  now: Date = new Date(),
): Promise<{ messages: number; pendingCleared: number; staleChecks: number }> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60_000);
  const staleBefore = new Date(now.getTime() - STALE_CHECK_MINUTES * 60_000);
  return db.transaction(async (tx) => {
    const stale = await tx
      .update(checks)
      .set({ status: "failed", finishedAt: now, failure: "never finished" })
      .where(and(eq(checks.status, "running"), lt(checks.createdAt, staleBefore)))
      .returning({ id: checks.id, senderId: checks.senderId });
    for (const c of stale) await audit(tx, "check_failed", c.senderId, { checkId: c.id, reason: "never finished" }, now);
    const deleted = await tx.delete(messages).where(lt(messages.receivedAt, cutoff)).returning({ id: messages.id });
    const cleared = await tx
      .update(senders)
      .set({ displayName: null, username: null, contactRef: null })
      .where(and(eq(senders.status, "pending"), lt(senders.createdAt, cutoff)))
      .returning({ id: senders.id });
    const result = { messages: deleted.length, pendingCleared: cleared.length, staleChecks: stale.length };
    await audit(tx, "retention_run", null, result, now);
    return result;
  });
}

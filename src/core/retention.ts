import { and, eq, lt } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { messages, senders } from "../db/schema.js";
import { audit } from "./audit.js";

export const RETENTION_DAYS = 30;

/**
 * The daily retention job. Forwarded messages (their text and image
 * references) are deleted after 30 days, and a pending sender's name,
 * username and chat ID are cleared if no one has decided on them in that
 * time. Checks, verdicts, traces and the audit log are kept: none of them
 * hold message text.
 */
export async function applyRetention(db: Db, now: Date = new Date()): Promise<{ messages: number; pendingCleared: number }> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60_000);
  return db.transaction(async (tx) => {
    const deleted = await tx.delete(messages).where(lt(messages.receivedAt, cutoff)).returning({ id: messages.id });
    const cleared = await tx
      .update(senders)
      .set({ displayName: null, username: null, contactRef: null })
      .where(and(eq(senders.status, "pending"), lt(senders.createdAt, cutoff)))
      .returning({ id: senders.id });
    const result = { messages: deleted.length, pendingCleared: cleared.length };
    await audit(tx, "retention_run", null, result, now);
    return result;
  });
}

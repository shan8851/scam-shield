import type { Db } from "../db/client";
import { auditLog } from "../db/schema";

/**
 * Every policy decision the gate makes. Kept as a closed list so the audit
 * log can be read and counted by event.
 */
export type AuditEvent =
  | "duplicate"
  | "unknown_sender"
  | "pending_sender"
  | "denied_sender"
  | "unsupported_kind"
  | "cool_off"
  | "budget_exhausted"
  | "admitted"
  | "sender_allowed"
  | "sender_denied";

/** Appends one row. The table rejects updates and deletes at the database. */
export async function audit(
  db: Pick<Db, "insert">,
  event: AuditEvent,
  senderId: string | null,
  detail?: Record<string, unknown>,
  at?: Date,
): Promise<void> {
  await db.insert(auditLog).values({ event, senderId, detail, ...(at ? { at } : {}) });
}

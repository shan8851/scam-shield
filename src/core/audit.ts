import type { Db } from "../db/client.js";
import { auditLog } from "../db/schema.js";

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
  | "queued"
  | "admitted"
  | "check_done"
  | "check_failed"
  | "sender_allowed"
  | "sender_denied"
  | "paused"
  | "resumed"
  | "paused_reply"
  | "alert_sent"
  | "retention_run";

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

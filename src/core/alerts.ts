import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { auditLog, checks } from "../db/schema.js";
import { audit } from "./audit.js";

/**
 * Alerts to the admin when something looks wrong. Each kind is sent at most
 * once per quiet period, recorded in the audit log, so a bad hour produces
 * one message rather than a stream of them.
 */
export type AlertKind = "budget_exhausted" | "failures_in_a_row" | "stranger_burst";

export const alertRules = {
  /** The global daily budget ran out. */
  budget_exhausted: { quietMinutes: 24 * 60 },
  /** The last `count` checks all failed. */
  failures_in_a_row: { quietMinutes: 60, count: 3 },
  /** At least `count` unknown senders within `windowMinutes`. */
  stranger_burst: { quietMinutes: 60, count: 3, windowMinutes: 60 },
} as const;

/**
 * Decides whether an event should alert the admin, and records it if so.
 * Returns the alert kind to send, or null.
 */
export async function alertFor(
  db: Db,
  event: "budget_exhausted" | "check_failed" | "unknown_sender",
  now: Date = new Date(),
): Promise<AlertKind | null> {
  const kind = await triggered(db, event, now);
  if (!kind) return null;
  const quietSince = new Date(now.getTime() - alertRules[kind].quietMinutes * 60_000);
  const [recent] = await db
    .select({ n: count() })
    .from(auditLog)
    .where(and(eq(auditLog.event, "alert_sent"), gt(auditLog.at, quietSince), sql`${auditLog.detail} ->> 'kind' = ${kind}`));
  if ((recent?.n ?? 0) > 0) return null;
  await audit(db, "alert_sent", null, { kind }, now);
  return kind;
}

async function triggered(db: Db, event: "budget_exhausted" | "check_failed" | "unknown_sender", now: Date): Promise<AlertKind | null> {
  if (event === "budget_exhausted") return "budget_exhausted";

  if (event === "check_failed") {
    const { count: n } = alertRules.failures_in_a_row;
    const last = await db.select({ status: checks.status }).from(checks).where(sql`${checks.status} <> 'running'`).orderBy(desc(checks.createdAt)).limit(n);
    return last.length === n && last.every((c) => c.status === "failed") ? "failures_in_a_row" : null;
  }

  const { count: n, windowMinutes } = alertRules.stranger_burst;
  const since = new Date(now.getTime() - windowMinutes * 60_000);
  const [row] = await db.select({ n: count() }).from(auditLog).where(and(eq(auditLog.event, "unknown_sender"), gt(auditLog.at, since)));
  return (row?.n ?? 0) >= n ? "stranger_burst" : null;
}

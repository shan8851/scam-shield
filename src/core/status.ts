import { and, count, eq, gt, sum } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { checks, senders } from "../db/schema.js";
import { isPaused } from "./settings.js";

export interface StatusSummary {
  paused: boolean;
  checks24h: number;
  failed24h: number;
  tokens24h: number;
  pending: number;
  allowed: number;
}

/** What /status shows: the last 24 hours, and who's waiting. */
export async function statusSummary(db: Db, now: Date = new Date()): Promise<StatusSummary> {
  const since = new Date(now.getTime() - 24 * 60 * 60_000);
  const [all] = await db.select({ n: count(), tokens: sum(checks.tokens) }).from(checks).where(gt(checks.createdAt, since));
  const [failed] = await db.select({ n: count() }).from(checks).where(and(gt(checks.createdAt, since), eq(checks.status, "failed")));
  const [pending] = await db.select({ n: count() }).from(senders).where(eq(senders.status, "pending"));
  const [allowed] = await db.select({ n: count() }).from(senders).where(eq(senders.status, "allowed"));
  return {
    paused: await isPaused(db),
    checks24h: all?.n ?? 0,
    failed24h: failed?.n ?? 0,
    tokens24h: Number(all?.tokens ?? 0),
    pending: pending?.n ?? 0,
    allowed: allowed?.n ?? 0,
  };
}

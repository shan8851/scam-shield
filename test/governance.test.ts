import { beforeEach, describe, expect, it } from "vitest";
import { GET as retentionCron } from "../api/cron/retention";
import { alertFor } from "../src/core/alerts";
import { admit, intake } from "../src/core/gate";
import { applyRetention } from "../src/core/retention";
import { allowSender } from "../src/core/senders";
import type { Db } from "../src/db/client";
import { checks, messages, senders } from "../src/db/schema";
import { forward, freshDb, minutes, numbers, secret } from "./helpers";

const t0 = new Date("2026-11-26T09:00:00Z");
let db: Db;

beforeEach(async () => {
  db = await freshDb();
});

describe("alerts", () => {
  it("raises the budget alert once a day, not on every turned-away batch", async () => {
    expect(await alertFor(db, "budget_exhausted", t0)).toBe("budget_exhausted");
    expect(await alertFor(db, "budget_exhausted", minutes(t0, 30))).toBeNull();
    expect(await alertFor(db, "budget_exhausted", minutes(t0, 25 * 60))).toBe("budget_exhausted");
  });

  it("raises the failure alert only when the last three checks all failed", async () => {
    const sender = await allowSender(db, numbers.alice, { secret, now: t0 });
    const add = (status: "done" | "failed", m: number) => db.insert(checks).values({ senderId: sender, createdAt: minutes(t0, m), status });
    await add("failed", 1);
    await add("failed", 2);
    expect(await alertFor(db, "check_failed", minutes(t0, 2))).toBeNull();
    await add("failed", 3);
    expect(await alertFor(db, "check_failed", minutes(t0, 3))).toBe("failures_in_a_row");
    await add("done", 4);
    await add("failed", 5);
    expect(await alertFor(db, "check_failed", minutes(t0, 120))).toBeNull();
  });

  it("raises the stranger alert on the third unknown sender within an hour", async () => {
    for (let i = 0; i < 3; i++) await intake(db, forward(`cli:stranger${i}`, minutes(t0, i)), { secret, now: minutes(t0, i) });
    expect(await alertFor(db, "unknown_sender", minutes(t0, 3))).toBe("stranger_burst");
    expect(await alertFor(db, "unknown_sender", minutes(t0, 4))).toBeNull();
  });
});

describe("retention", () => {
  it("deletes messages older than 30 days and clears stale pending details", async () => {
    const alice = await allowSender(db, numbers.alice, { secret, now: t0 });
    const old = await intake(db, forward(numbers.alice, t0, { text: "old message" }), { secret, now: t0 });
    await admit(db, alice, { asOf: old.messageId, now: t0 });
    const later = minutes(t0, 29 * 24 * 60);
    await intake(db, forward(numbers.alice, later, { text: "recent message" }), { secret, now: later });
    await intake(db, forward(numbers.stranger, t0, { sender: { key: numbers.stranger, displayName: "Stranger", contactRef: "123" } }), { secret, now: t0 });

    const result = await applyRetention(db, minutes(t0, 31 * 24 * 60));
    // The month-old check never finished, so the sweep marks it failed too.
    expect(result).toEqual({ messages: 1, pendingCleared: 1, staleChecks: 1 });
    expect((await db.select().from(messages)).map((m) => m.text)).toEqual(["recent message"]);
    expect(await db.select().from(checks)).toHaveLength(1);
  });

  it("marks checks stuck at 'running' as failed, leaving recent and finished ones alone", async () => {
    const sender = await allowSender(db, numbers.alice, { secret, now: t0 });
    await db.insert(checks).values([
      { senderId: sender, createdAt: t0 },
      { senderId: sender, createdAt: minutes(t0, 55) },
      { senderId: sender, createdAt: t0, status: "done" },
    ]);
    expect((await applyRetention(db, minutes(t0, 60))).staleChecks).toBe(1);
    const rows = await db.select().from(checks).orderBy(checks.createdAt);
    expect(rows.map((c) => c.status).sort()).toEqual(["done", "failed", "running"]);
    expect(await alertFor(db, "check_failed", minutes(t0, 60))).toBeNull();
  });

  it("clears a pending sender's name, username and chat ID after 30 days undecided", async () => {
    await db.insert(senders).values({ senderHash: "h", status: "pending", displayName: "X", username: "x", contactRef: "1", createdAt: t0 });
    expect((await applyRetention(db, minutes(t0, 31 * 24 * 60))).pendingCleared).toBe(1);
    const [row] = await db.select().from(senders);
    expect(row).toMatchObject({ status: "pending", displayName: null, username: null, contactRef: null });
  });

  it("refuses to run the cron without Vercel's secret", async () => {
    process.env.CRON_SECRET = "cron-secret-for-tests";
    expect((await retentionCron(new Request("https://x/api/cron/retention"))).status).toBe(403);
    expect((await retentionCron(new Request("https://x/api/cron/retention", { headers: { authorization: "Bearer wrong" } }))).status).toBe(403);
  });
});

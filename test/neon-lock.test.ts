import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateNeonDb, openNeon, type Db } from "../src/db/client";
import { count, eq } from "drizzle-orm";
import { admit, intake } from "../src/core/gate";
import { checks } from "../src/db/schema";
import { allowSender } from "../src/core/senders";
import { forward, secret } from "./helpers";

/**
 * PGlite runs on one connection, so it can't prove the gate's lock holds
 * when messages really arrive at once. This test does, against real Postgres
 * on a Neon branch with separate pooled connections. It runs only when
 * NEON_TEST_URL is set (a dev branch, never production): each run leaves a
 * few rows behind, and audit rows can't be deleted by design.
 */
const url = process.env.NEON_TEST_URL;

describe.skipIf(!url)("gate lock on real Postgres (Neon)", () => {
  let db: Db;
  let close: () => Promise<void>;

  beforeAll(async () => {
    await migrateNeonDb(url!);
    ({ db, close } = openNeon(url!));
  });
  afterAll(async () => close?.());

  it("lets ten simultaneous handlers create exactly one check, then enforces the cool-off", async () => {
    const key = `test:${randomUUID()}`;
    const senderId = await allowSender(db, key, { secret });
    const t = (ms: number) => new Date(Date.now() + ms);

    // Four checks already used in the cool-off window.
    for (let i = 0; i < 4; i++) {
      const m = await intake(db, forward(key, t(i)), { secret, now: t(i) });
      await admit(db, senderId, { asOf: m.messageId, now: t(i) });
    }

    // A burst of three messages, then ten handlers all trying to claim it at once.
    for (let i = 0; i < 3; i++) await intake(db, forward(key, t(10 + i)), { secret, now: t(10 + i) });
    const results = await Promise.all(Array.from({ length: 10 }, () => admit(db, senderId, { now: t(20) })));
    expect(results.filter((r) => r.outcome === "admitted")).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "nothing_queued")).toHaveLength(9);
    expect(results.find((r) => r.outcome === "admitted")?.batch).toHaveLength(3);
    const [row] = await db.select({ n: count() }).from(checks).where(eq(checks.senderId, senderId));
    expect(row?.n).toBe(5);

    // That was the fifth check in ten minutes: the next batch is turned away.
    const next = await intake(db, forward(key, t(30)), { secret, now: t(30) });
    expect((await admit(db, senderId, { asOf: next.messageId, now: t(30) })).outcome).toBe("cool_off");
  }, 60_000);
});

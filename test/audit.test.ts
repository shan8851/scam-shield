import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { auditLog } from "../src/db/schema";
import { gate } from "../src/core/gate";
import { allowSender } from "../src/core/senders";
import { forward, freshDb, numbers, secret } from "./helpers";

const t0 = new Date("2026-11-20T09:00:00Z");
let db: Db;

beforeEach(async () => {
  db = await freshDb();
  await allowSender(db, numbers.alice, { secret, now: t0 });
  await gate(db, forward(numbers.alice, t0), { secret, now: t0 });
  await gate(db, forward(numbers.stranger, t0, { sender: { key: numbers.stranger, displayName: "Stranger" } }), { secret, now: t0 });
});

describe("audit log", () => {
  it("records every decision", async () => {
    const events = (await db.select().from(auditLog)).map((r) => r.event);
    expect(events).toEqual(["sender_allowed", "queued", "admitted", "unknown_sender"]);
  });

  it("never holds a phone number, a name or message text", async () => {
    const dump = JSON.stringify(await db.select().from(auditLog));
    for (const leak of ["alice", "stranger", "Stranger", "parcel"]) {
      expect(dump).not.toContain(leak);
    }
  });

  it("rejects updates, deletes and truncation at the database", async () => {
    for (const statement of [
      sql`update audit_log set event = 'x'`,
      sql`delete from audit_log`,
      sql`truncate audit_log`,
    ]) {
      // Drizzle wraps the database error; the trigger's message is the cause.
      const error = await db.execute(statement).then(() => null, (e: Error) => e);
      expect(String((error?.cause as Error | undefined)?.message)).toMatch(/append-only/);
    }
    expect(await db.select().from(auditLog)).toHaveLength(4);
  });
});

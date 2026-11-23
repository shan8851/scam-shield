import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { auditLog, checks, messages, senders } from "../src/db/schema";
import { gate } from "../src/core/gate";
import { allowSender, denySender, listPending } from "../src/core/senders";
import { forward, freshDb, minutes, numbers, secret } from "./helpers";

const t0 = new Date("2026-11-20T09:00:00Z");
let db: Db;

const send = (from: string, at: Date, overrides = {}) =>
  gate(db, forward(from, at, overrides), { secret, now: at });

beforeEach(async () => {
  db = await freshDb();
  await allowSender(db, numbers.alice, { secret, nickname: "Alice", now: t0 });
});

describe("unknown senders", () => {
  it("get one invite-only reply, land in pending, and their message isn't stored", async () => {
    const result = await send(numbers.stranger, t0, { sender: { key: numbers.stranger, displayName: "Stranger", username: "stranger99" } });
    expect(result).toMatchObject({ outcome: "unknown_sender", reply: "inviteOnly" });
    expect(await db.select().from(messages)).toHaveLength(0);
    expect(await listPending(db)).toMatchObject([{ displayName: "Stranger", username: "stranger99" }]);
  });

  it("get silence after that", async () => {
    await send(numbers.stranger, t0);
    const again = await send(numbers.stranger, minutes(t0, 1));
    expect(again).toMatchObject({ outcome: "pending_sender", reply: null });
  });

  it("lose their name and username once approved, then get through", async () => {
    const { senderId } = await send(numbers.stranger, t0, { sender: { key: numbers.stranger, displayName: "Stranger", username: "stranger99" } });
    await allowSender(db, numbers.stranger, { secret, now: minutes(t0, 5) });
    const [row] = await db.select().from(senders).where(eq(senders.id, senderId!));
    expect(row).toMatchObject({ status: "allowed", displayName: null, username: null });
    expect(await listPending(db)).toHaveLength(0);
    expect((await send(numbers.stranger, minutes(t0, 6))).outcome).toBe("admitted");
  });
});

describe("denied senders", () => {
  it("are ignored silently", async () => {
    await denySender(db, numbers.bob, { secret, now: t0 });
    expect(await send(numbers.bob, t0)).toMatchObject({ outcome: "denied_sender", reply: null });
  });
});

describe("allowed senders", () => {
  it("are admitted: a check is reserved and the message attached to it", async () => {
    const result = await send(numbers.alice, t0);
    expect(result).toMatchObject({ outcome: "admitted", reply: "checking" });
    const [message] = await db.select().from(messages);
    expect(message?.checkId).toBe(result.checkId);
  });

  it("can't be double-counted by a redelivered message", async () => {
    const first = forward(numbers.alice, t0, { externalId: "tg-update-1" });
    await gate(db, first, { secret, now: t0 });
    const again = await gate(db, first, { secret, now: minutes(t0, 1) });
    expect(again).toMatchObject({ outcome: "duplicate", reply: null });
    expect(await db.select().from(checks)).toHaveLength(1);
  });

  it("get a fixed reply for kinds v1 can't read, without using a check", async () => {
    expect((await send(numbers.alice, t0, { kind: "voice", text: undefined })).reply).toBe("unsupportedVoice");
    expect((await send(numbers.alice, t0, { kind: "document", text: undefined })).reply).toBe("unsupportedDocument");
    expect((await send(numbers.alice, t0, { kind: "video", text: undefined })).reply).toBe("unsupportedOther");
    expect(await db.select().from(checks)).toHaveLength(0);
  });
});

describe("cool-off", () => {
  it("allows 5 checks in 10 minutes, then says so once, then stays quiet", async () => {
    for (let i = 0; i < 5; i++) expect((await send(numbers.alice, minutes(t0, i))).outcome).toBe("admitted");
    expect(await send(numbers.alice, minutes(t0, 5))).toMatchObject({ outcome: "cool_off", reply: "coolOff" });
    expect(await send(numbers.alice, minutes(t0, 6))).toMatchObject({ outcome: "cool_off", reply: null });
  });

  it("slides: once the oldest check is 10 minutes old, there's room again", async () => {
    for (let i = 0; i < 5; i++) await send(numbers.alice, minutes(t0, i));
    expect((await send(numbers.alice, minutes(t0, 9))).outcome).toBe("cool_off");
    expect((await send(numbers.alice, minutes(t0, 10.5))).outcome).toBe("admitted");
  });

  it("caps a sender at 20 checks in 24 hours", async () => {
    for (let i = 0; i < 20; i++) expect((await send(numbers.alice, minutes(t0, i * 11))).outcome).toBe("admitted");
    const result = await send(numbers.alice, minutes(t0, 20 * 11));
    expect(result).toMatchObject({ outcome: "cool_off", reply: "coolOff" });
    const [row] = await db.select().from(auditLog).where(eq(auditLog.event, "cool_off"));
    expect(row?.detail).toMatchObject({ windowMinutes: 1440, maxChecks: 20, used: 20 });
  });
});

describe("global daily budget", () => {
  it("stops everyone after 50 checks in 24 hours, telling each sender once", async () => {
    const people = Array.from({ length: 11 }, (_, i) => `cli:person${i}`);
    for (const p of people) await allowSender(db, p, { secret, now: t0 });
    for (let i = 0; i < 50; i++) {
      const p = people[i % 10]!;
      expect((await send(p, minutes(t0, i))).outcome).toBe("admitted");
    }
    const last = people[10]!;
    expect(await send(last, minutes(t0, 60))).toMatchObject({ outcome: "budget_exhausted", reply: "busyToday" });
    expect(await send(last, minutes(t0, 61))).toMatchObject({ outcome: "budget_exhausted", reply: null });
    expect(await send(numbers.alice, minutes(t0, 62))).toMatchObject({ reply: "busyToday" });
  });
});

describe("concurrency", () => {
  it("lets exactly one of several simultaneous messages take the last slot", async () => {
    for (let i = 0; i < 4; i++) await send(numbers.alice, minutes(t0, i));
    const at = minutes(t0, 5);
    const results = await Promise.all(Array.from({ length: 6 }, () => send(numbers.alice, at)));
    expect(results.filter((r) => r.outcome === "admitted")).toHaveLength(1);
    expect(await db.select().from(checks)).toHaveLength(5);
  });
});

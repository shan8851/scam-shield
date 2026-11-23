import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/client";
import { checks, messages } from "../src/db/schema";
import { admit, intake } from "../src/core/gate";
import { allowSender } from "../src/core/senders";
import { forward, freshDb, minutes, numbers, secret } from "./helpers";

const t0 = new Date("2026-11-23T09:00:00Z");
let db: Db;
let alice: string;

const take = (text: string, at: Date, over = {}) => intake(db, forward(numbers.alice, at, { text, ...over }), { secret, now: at });

beforeEach(async () => {
  db = await freshDb();
  alice = await allowSender(db, numbers.alice, { secret, now: t0 });
});

describe("gathering a burst into one check", () => {
  it("queues each message, then checks them together once the latest handler admits", async () => {
    const a = await take("screenshot one", t0, { kind: "image", text: undefined, mediaRefs: ["file-a"] });
    const b = await take("screenshot two", minutes(t0, 0.02), { kind: "image", text: undefined, mediaRefs: ["file-b"] });
    const c = await take("is this legit?", minutes(t0, 0.04));
    expect([a.outcome, b.outcome, c.outcome]).toEqual(["queued", "queued", "queued"]);

    // Earlier handlers wake up, see a newer message, and stand down.
    expect((await admit(db, alice, { asOf: a.messageId, now: minutes(t0, 0.1) })).outcome).toBe("superseded");

    const result = await admit(db, alice, { asOf: c.messageId, now: minutes(t0, 0.12) });
    expect(result).toMatchObject({ outcome: "admitted", reply: "checking" });
    expect(result.batch).toEqual([
      { text: null, mediaRefs: ["file-a"], forwarded: false },
      { text: null, mediaRefs: ["file-b"], forwarded: false },
      { text: "is this legit?", mediaRefs: [], forwarded: false },
    ]);
    expect(await db.select().from(checks)).toHaveLength(1);
  });

  it("does nothing when there's nothing left to check", async () => {
    const a = await take("hello", t0);
    await admit(db, alice, { asOf: a.messageId, now: t0 });
    expect((await admit(db, alice, { asOf: a.messageId, now: t0 })).outcome).toBe("nothing_queued");
  });

  it("drops a batch the limits turn away, so it can't resurface later", async () => {
    for (let i = 0; i < 5; i++) {
      const m = await take(`check ${i}`, minutes(t0, i));
      await admit(db, alice, { asOf: m.messageId, now: minutes(t0, i) });
    }
    const blocked = await take("sixth", minutes(t0, 5));
    expect((await admit(db, alice, { asOf: blocked.messageId, now: minutes(t0, 5) })).outcome).toBe("cool_off");

    const later = await take("after the cool-off", minutes(t0, 20));
    const result = await admit(db, alice, { asOf: later.messageId, now: minutes(t0, 20) });
    expect(result.batch?.map((m) => m.text)).toEqual(["after the cool-off"]);
    const [dropped] = await db.select().from(messages).where(eq(messages.id, blocked.messageId!));
    expect(dropped?.status).toBe("dropped");
  });

  it("never puts an unsupported message in a batch", async () => {
    await take("", t0, { kind: "voice", text: undefined });
    const m = await take("text", minutes(t0, 0.01));
    const result = await admit(db, alice, { asOf: m.messageId, now: minutes(t0, 0.02) });
    expect(result.batch).toHaveLength(1);
  });

  it("keeps the forwarded flag", async () => {
    const m = await take("forwarded text", t0, { forwarded: true });
    expect((await admit(db, alice, { asOf: m.messageId, now: t0 })).batch?.[0]?.forwarded).toBe(true);
  });
});

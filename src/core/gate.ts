import { and, asc, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { auditLog, checks, messages, senders } from "../db/schema.js";
import type { ReplyKey } from "../replies/copy.js";
import { audit, type AuditEvent } from "./audit.js";
import { limits } from "./config.js";
import { supportedKinds, type Forward, type ForwardKind } from "./forward.js";
import { hashSender } from "./identity.js";
import { isPaused } from "./settings.js";

/**
 * The gate decides what happens to inbound messages before any model is
 * called. It's where "nobody can burn the tokens" is enforced, in code.
 *
 * It runs in two halves, so a burst of messages can be checked together:
 *
 *   intake(message)  per message:  who sent it, duplicates, supported kind
 *   admit(sender)    per batch:    cool-off and budget, then reserve a check
 *
 * The CLI runs both back to back (`gate`). The Telegram adapter runs intake
 * on each update and admit once per burst, after the gathering window.
 *
 * Both halves run in a transaction holding one advisory lock, so decisions
 * happen one after another: a lock, a count, an insert. Serialising every
 * decision is fine at this volume and makes the limits race-proof.
 */

/** Any fixed key for the advisory lock that serialises all gate decisions. */
const GATE_LOCK_KEY = 7_220_001;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type IntakeOutcome =
  | "paused"
  | "unknown_sender"
  | "pending_sender"
  | "denied_sender"
  | "duplicate"
  | "unsupported_kind"
  | "queued";

export interface IntakeResult {
  outcome: IntakeOutcome;
  /** The fixed reply to send, or null for silence. */
  reply: ReplyKey | null;
  senderId: string;
  /** Set when the message was queued for a check. */
  messageId?: string;
}

export type AdmitOutcome = "admitted" | "superseded" | "nothing_queued" | "paused" | "cool_off" | "budget_exhausted";

export interface QueuedMessage {
  text: string | null;
  mediaRefs: string[];
  forwarded: boolean;
}

export interface AdmitResult {
  outcome: AdmitOutcome;
  reply: ReplyKey | null;
  /** Set when admitted: the check, and the messages it covers in order. */
  checkId?: string;
  batch?: QueuedMessage[];
}

/** Steps 1–3: who sent it, has it been seen, can v1 read it. */
export async function intake(
  db: Db,
  forward: Forward,
  opts: { secret: string; now?: Date },
): Promise<IntakeResult> {
  const now = opts.now ?? new Date();
  const senderHash = hashSender(forward.sender.key, opts.secret);

  return db.transaction(async (tx) => {
    await lock(tx);
    const decide = async (outcome: IntakeOutcome, reply: ReplyKey | null, senderId: string, detail?: Record<string, unknown>) => {
      await audit(tx, outcome satisfies AuditEvent, senderId, { ...detail, replied: reply !== null }, now);
      return { outcome, reply, senderId };
    };

    const [sender] = await tx.select().from(senders).where(eq(senders.senderHash, senderHash));

    // 1. Not invited: remember them as pending, reply once, never again.
    //    Their message content is never stored.
    if (!sender) {
      const [created] = await tx
        .insert(senders)
        .values({
          senderHash,
          status: "pending",
          displayName: forward.sender.displayName ?? null,
          username: forward.sender.username ?? null,
          contactRef: forward.sender.contactRef ?? null,
        })
        .returning({ id: senders.id });
      return decide("unknown_sender", "inviteOnly", created!.id);
    }
    if (sender.status === "pending") return decide("pending_sender", null, sender.id);
    if (sender.status === "denied") return decide("denied_sender", null, sender.id);

    // The kill switch: nothing is stored or checked while paused. Say so once
    // every ten minutes, not on every message.
    if (await isPaused(tx)) {
      const told = await toldRecently(tx, sender.id, "paused_reply", since(now, 10));
      await audit(tx, "paused_reply", sender.id, { replied: !told }, now);
      return { outcome: "paused", reply: told ? null : "paused", senderId: sender.id };
    }

    // 2. Store the message; a second delivery of the same ID stops here.
    const supported = supportedKinds.has(forward.kind);
    const [stored] = await tx
      .insert(messages)
      .values({
        externalId: forward.externalId,
        senderId: sender.id,
        kind: forward.kind,
        text: forward.text ?? null,
        mediaRefs: forward.mediaRefs ?? null,
        forwarded: forward.forwarded ?? false,
        receivedAt: forward.receivedAt,
        status: supported ? "queued" : "dropped",
      })
      .onConflictDoNothing({ target: messages.externalId })
      .returning({ id: messages.id });
    if (!stored) return decide("duplicate", null, sender.id);

    // 3. Kinds v1 can't read get a fixed reply and never reach the limits.
    if (!supported) return decide("unsupported_kind", unsupportedReply(forward.kind), sender.id, { kind: forward.kind });

    await audit(tx, "queued", sender.id, undefined, now);
    return { outcome: "queued", reply: null, senderId: sender.id, messageId: stored.id };
  });
}

/**
 * Step 4: one decision for everything a sender has queued. Called by the
 * handler for the sender's latest message once the gathering window ends;
 * earlier handlers find they're `superseded` and stop. Messages turned away
 * by the limits are dropped, so they can't resurface in a later batch.
 */
export async function admit(
  db: Db,
  senderId: string,
  opts: { now?: Date; asOf?: string } = {},
): Promise<AdmitResult> {
  const now = opts.now ?? new Date();

  return db.transaction(async (tx) => {
    await lock(tx);
    const queued = await tx
      .select()
      .from(messages)
      .where(and(eq(messages.senderId, senderId), eq(messages.status, "queued")))
      .orderBy(asc(messages.receivedAt), asc(messages.id));
    if (queued.length === 0) return { outcome: "nothing_queued", reply: null };

    const [latest] = await tx
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.senderId, senderId), eq(messages.status, "queued")))
      .orderBy(desc(messages.receivedAt), desc(messages.id))
      .limit(1);
    if (opts.asOf && latest!.id !== opts.asOf) return { outcome: "superseded", reply: null };

    const ids = queued.map((m) => m.id);

    // Paused after these were queued: drop them quietly (intake has already
    // told the sender, or will on their next message).
    if (await isPaused(tx)) {
      await tx.update(messages).set({ status: "dropped" }).where(inArray(messages.id, ids));
      return { outcome: "paused", reply: null };
    }
    const turnAway = async (event: "cool_off" | "budget_exhausted", reply: ReplyKey, windowMinutes: number, detail: Record<string, unknown>) => {
      await tx.update(messages).set({ status: "dropped" }).where(inArray(messages.id, ids));
      // Say so once per window, not on every batch, so a flood doesn't turn
      // into a flood of replies.
      const told = await toldRecently(tx, senderId, event, since(now, windowMinutes));
      await audit(tx, event, senderId, { ...detail, messages: ids.length, replied: !told }, now);
      return { outcome: event, reply: told ? null : reply };
    };

    for (const { windowMinutes, maxChecks } of limits.perSender) {
      const used = await countChecks(tx, since(now, windowMinutes), senderId);
      if (used >= maxChecks) return turnAway("cool_off", "coolOff", windowMinutes, { windowMinutes, maxChecks, used });
    }
    const { windowMinutes, maxChecks } = limits.global;
    const usedGlobally = await countChecks(tx, since(now, windowMinutes));
    if (usedGlobally >= maxChecks) {
      return turnAway("budget_exhausted", "busyToday", windowMinutes, { windowMinutes, maxChecks, used: usedGlobally });
    }

    const [check] = await tx.insert(checks).values({ senderId, createdAt: now }).returning({ id: checks.id });
    await tx.update(messages).set({ status: "claimed", checkId: check!.id }).where(inArray(messages.id, ids));
    await audit(tx, "admitted", senderId, { checkId: check!.id, messages: ids.length, replied: true }, now);
    return {
      outcome: "admitted",
      reply: "checking",
      checkId: check!.id,
      batch: queued.map((m) => ({ text: m.text, mediaRefs: m.mediaRefs ?? [], forwarded: m.forwarded })),
    };
  });
}

export interface GateResult {
  outcome: Exclude<IntakeOutcome | AdmitOutcome, "queued">;
  reply: ReplyKey | null;
  senderId: string;
  checkId?: string;
  batch?: QueuedMessage[];
}

/** Intake and admit back to back, for channels with no gathering window (the CLI). */
export async function gate(db: Db, forward: Forward, opts: { secret: string; now?: Date }): Promise<GateResult> {
  const taken = await intake(db, forward, opts);
  if (taken.outcome !== "queued") return { ...taken, outcome: taken.outcome };
  const admitted = await admit(db, taken.senderId, { now: opts.now, asOf: taken.messageId });
  return { ...admitted, senderId: taken.senderId };
}

async function lock(tx: Tx) {
  await tx.execute(sql`select pg_advisory_xact_lock(${GATE_LOCK_KEY})`);
}

function since(now: Date, minutes: number): Date {
  return new Date(now.getTime() - minutes * 60_000);
}

async function countChecks(tx: Tx, after: Date, senderId?: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(checks)
    .where(senderId ? and(eq(checks.senderId, senderId), gt(checks.createdAt, after)) : gt(checks.createdAt, after));
  return row?.n ?? 0;
}

async function toldRecently(tx: Tx, senderId: string, event: AuditEvent, after: Date): Promise<boolean> {
  const [row] = await tx
    .select({ n: count() })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.senderId, senderId),
        eq(auditLog.event, event),
        gt(auditLog.at, after),
        sql`${auditLog.detail} ->> 'replied' = 'true'`,
      ),
    );
  return (row?.n ?? 0) > 0;
}

function unsupportedReply(kind: ForwardKind): ReplyKey {
  if (kind === "voice") return "unsupportedVoice";
  if (kind === "document") return "unsupportedDocument";
  return "unsupportedOther";
}

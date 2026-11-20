import { and, count, eq, gt, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { auditLog, checks, messages, senders } from "../db/schema";
import { audit, type AuditEvent } from "./audit";
import { limits } from "./config";
import { supportedKinds, type Forward, type ForwardKind } from "./forward";
import { hashNumber, last4 } from "./identity";
import type { ReplyKey } from "./replies";

export type GateOutcome =
  | "duplicate"
  | "unknown_sender"
  | "pending_sender"
  | "denied_sender"
  | "unsupported_kind"
  | "cool_off"
  | "budget_exhausted"
  | "admitted";

export interface GateResult {
  outcome: GateOutcome;
  /** The fixed reply to send, or null for silence. */
  reply: ReplyKey | null;
  senderId: string | null;
  /** Set only when admitted: the check this message now belongs to. */
  checkId?: string;
}

/** Any fixed key for the advisory lock that serialises all gate decisions. */
const GATE_LOCK_KEY = 7_220_001;

/**
 * Decides what happens to one inbound message, before any model is called.
 * This is where "nobody can burn the tokens" is enforced, in code.
 *
 * Order matters:
 *  1. Unknown and denied senders are dealt with first, and their message
 *     content is never stored.
 *  2. Duplicates (a webhook delivered twice) stop at the unique message ID.
 *  3. Unsupported kinds get a fixed reply and cost nothing.
 *  4. Limits are counted from check rows in sliding windows.
 *
 * Everything runs in one transaction holding one advisory lock, so two
 * messages arriving at once are decided one after the other: a lock, a
 * count, an insert. Serialising every decision is fine at this volume.
 */
export async function gate(
  db: Db,
  forward: Forward,
  opts: { secret: string; now?: Date },
): Promise<GateResult> {
  const now = opts.now ?? new Date();
  const numberHash = hashNumber(forward.senderNumber, opts.secret);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${GATE_LOCK_KEY})`);

    const [sender] = await tx
      .select()
      .from(senders)
      .where(eq(senders.numberHash, numberHash));

    const decide = async (
      outcome: GateOutcome,
      reply: ReplyKey | null,
      senderId: string | null,
      detail?: Record<string, unknown>,
    ): Promise<GateResult> => {
      await audit(tx, outcome satisfies AuditEvent, senderId, { ...detail, replied: reply !== null }, now);
      return { outcome, reply, senderId };
    };

    // 1. Not invited: remember them as pending, reply once, never again.
    if (!sender) {
      const [created] = await tx
        .insert(senders)
        .values({
          numberHash,
          status: "pending",
          last4: last4(forward.senderNumber),
          profileName: forward.senderProfileName ?? null,
        })
        .returning({ id: senders.id });
      return decide("unknown_sender", "inviteOnly", created!.id);
    }
    if (sender.status === "pending") return decide("pending_sender", null, sender.id);
    if (sender.status === "denied") return decide("denied_sender", null, sender.id);

    // 2. Store the message; a second delivery of the same ID stops here.
    const [stored] = await tx
      .insert(messages)
      .values({
        externalId: forward.externalId,
        senderId: sender.id,
        kind: forward.kind,
        text: forward.text ?? null,
        receivedAt: forward.receivedAt,
      })
      .onConflictDoNothing({ target: messages.externalId })
      .returning({ id: messages.id });
    if (!stored) return decide("duplicate", null, sender.id);

    // 3. Kinds v1 can't read get a fixed reply and never reach the limits.
    if (!supportedKinds.has(forward.kind)) {
      return decide("unsupported_kind", unsupportedReply(forward.kind), sender.id, {
        kind: forward.kind,
      });
    }

    // 4. Per-sender cool-off, then the global daily budget.
    for (const { windowMinutes, maxChecks } of limits.perSender) {
      const used = await countChecks(tx, since(now, windowMinutes), sender.id);
      if (used >= maxChecks) {
        // Say so once per window, not on every message, so a flood doesn't
        // turn into a flood of replies.
        const told = await toldRecently(tx, sender.id, "cool_off", since(now, windowMinutes));
        return decide("cool_off", told ? null : "coolOff", sender.id, {
          windowMinutes,
          maxChecks,
          used,
        });
      }
    }
    const { windowMinutes, maxChecks } = limits.global;
    const usedGlobally = await countChecks(tx, since(now, windowMinutes));
    if (usedGlobally >= maxChecks) {
      const told = await toldRecently(
        tx,
        sender.id,
        "budget_exhausted",
        since(now, windowMinutes),
      );
      return decide("budget_exhausted", told ? null : "busyToday", sender.id, {
        windowMinutes,
        maxChecks,
        used: usedGlobally,
      });
    }

    // Admitted: reserve the check and attach the message to it.
    const [check] = await tx
      .insert(checks)
      .values({ senderId: sender.id, createdAt: now })
      .returning({ id: checks.id });
    await tx.update(messages).set({ checkId: check!.id }).where(eq(messages.id, stored.id));
    await audit(tx, "admitted", sender.id, { checkId: check!.id, replied: true }, now);
    return { outcome: "admitted", reply: "checking", senderId: sender.id, checkId: check!.id };
  });
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function since(now: Date, minutes: number): Date {
  return new Date(now.getTime() - minutes * 60_000);
}

async function countChecks(tx: Tx, after: Date, senderId?: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(checks)
    .where(
      senderId
        ? and(eq(checks.senderId, senderId), gt(checks.createdAt, after))
        : gt(checks.createdAt, after),
    );
  return row?.n ?? 0;
}

async function toldRecently(
  tx: Tx,
  senderId: string,
  event: AuditEvent,
  after: Date,
): Promise<boolean> {
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

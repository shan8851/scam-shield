import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { senders } from "../db/schema.js";
import { audit } from "./audit.js";
import { hashSender } from "./identity.js";

/**
 * Approves a sender by their channel-qualified key, or pre-approves one that
 * hasn't messaged yet. Only the hash is stored; once decided, the display
 * name and username kept for the pending list are cleared.
 */
export async function allowSender(
  db: Db,
  key: string,
  opts: { secret: string; nickname?: string; now?: Date },
): Promise<string> {
  return decideSender(db, key, "allowed", opts);
}

/** Denies a sender. They are ignored silently from then on. */
export async function denySender(
  db: Db,
  key: string,
  opts: { secret: string; now?: Date },
): Promise<string> {
  return decideSender(db, key, "denied", opts);
}

async function decideSender(
  db: Db,
  key: string,
  status: "allowed" | "denied",
  opts: { secret: string; nickname?: string; now?: Date },
): Promise<string> {
  const now = opts.now ?? new Date();
  const senderHash = hashSender(key, opts.secret);
  const decided = {
    status,
    nickname: opts.nickname ?? null,
    displayName: null,
    username: null,
    contactRef: null,
    decidedAt: now,
  };
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(senders)
      .values({ senderHash, ...decided })
      .onConflictDoUpdate({ target: senders.senderHash, set: decided })
      .returning({ id: senders.id });
    await audit(tx, status === "allowed" ? "sender_allowed" : "sender_denied", row!.id, undefined, now);
    return row!.id;
  });
}

/** Senders waiting for a decision, as the admin sees them. */
export async function listPending(db: Db) {
  return db
    .select({
      id: senders.id,
      displayName: senders.displayName,
      username: senders.username,
      since: senders.createdAt,
    })
    .from(senders)
    .where(eq(senders.status, "pending"))
    .orderBy(senders.createdAt);
}

/**
 * The admin approves or denies a pending sender from a button. Returns who
 * it was (for the admin's confirmation) and where to welcome them, then
 * clears those details: decided senders keep only their hash.
 */
export async function decideById(
  db: Db,
  senderId: string,
  status: "allowed" | "denied",
  opts: { now?: Date } = {},
): Promise<{ displayName: string | null; username: string | null; contactRef: string | null; previous: string } | null> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(senders).where(eq(senders.id, senderId));
    if (!row) return null;
    await tx
      .update(senders)
      .set({ status, displayName: null, username: null, contactRef: null, decidedAt: now })
      .where(eq(senders.id, senderId));
    await audit(tx, status === "allowed" ? "sender_allowed" : "sender_denied", senderId, { by: "admin" }, now);
    return { displayName: row.displayName, username: row.username, contactRef: row.contactRef, previous: row.status };
  });
}

/**
 * Someone starts a conversation (/start or /help). The admin is always
 * allowed. An unknown sender becomes pending and gets the invite-only reply
 * once (and the admin is asked about them); pending and denied senders get
 * silence; allowed senders get the welcome. Nothing from the message is
 * stored.
 */
export async function introduce(
  db: Db,
  sender: { key: string; displayName?: string; username?: string; contactRef?: string },
  opts: { secret: string; adminKey?: string; now?: Date },
): Promise<{ reply: "welcome" | "inviteOnly" | null; newPendingId?: string }> {
  const now = opts.now ?? new Date();
  const senderHash = hashSender(sender.key, opts.secret);
  const [row] = await db.select().from(senders).where(eq(senders.senderHash, senderHash));

  if (opts.adminKey && sender.key === opts.adminKey) {
    if (row?.status !== "allowed") await allowSender(db, sender.key, { secret: opts.secret, nickname: "admin", now });
    return { reply: "welcome" };
  }
  if (!row) {
    const id = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(senders)
        .values({
          senderHash,
          status: "pending",
          displayName: sender.displayName ?? null,
          username: sender.username ?? null,
          contactRef: sender.contactRef ?? null,
        })
        .returning({ id: senders.id });
      await audit(tx, "unknown_sender", created!.id, { replied: true }, now);
      return created!.id;
    });
    return { reply: "inviteOnly", newPendingId: id };
  }
  return { reply: row.status === "allowed" ? "welcome" : null };
}

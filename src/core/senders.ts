import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { senders } from "../db/schema";
import { audit } from "./audit";
import { hashSender } from "./identity";

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

import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { senders } from "../db/schema";
import { audit } from "./audit";
import { hashNumber } from "./identity";

/**
 * Approves a sender, or pre-approves a number that hasn't messaged yet.
 * Only the hash is stored; once decided, the partial number and profile
 * name kept for the pending list are cleared.
 */
export async function allowSender(
  db: Db,
  number: string,
  opts: { secret: string; nickname?: string; now?: Date },
): Promise<string> {
  return decideSender(db, number, "allowed", opts);
}

/** Denies a sender. They are ignored silently from then on. */
export async function denySender(
  db: Db,
  number: string,
  opts: { secret: string; now?: Date },
): Promise<string> {
  return decideSender(db, number, "denied", opts);
}

async function decideSender(
  db: Db,
  number: string,
  status: "allowed" | "denied",
  opts: { secret: string; nickname?: string; now?: Date },
): Promise<string> {
  const now = opts.now ?? new Date();
  const numberHash = hashNumber(number, opts.secret);
  const decided = {
    status,
    nickname: opts.nickname ?? null,
    last4: null,
    profileName: null,
    decidedAt: now,
  };
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(senders)
      .values({ numberHash, ...decided })
      .onConflictDoUpdate({ target: senders.numberHash, set: decided })
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
      last4: senders.last4,
      profileName: senders.profileName,
      since: senders.createdAt,
    })
    .from(senders)
    .where(eq(senders.status, "pending"))
    .orderBy(senders.createdAt);
}

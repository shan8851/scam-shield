import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { settings } from "../db/schema.js";
import { audit } from "./audit.js";

type Reader = Pick<Db, "select">;

/** The kill switch: while on, the gate admits nothing. */
export async function isPaused(db: Reader): Promise<boolean> {
  const [row] = await db.select().from(settings).where(eq(settings.key, "paused"));
  return row?.value === true;
}

/** Turns the kill switch on or off, and audit-logs who did it. */
export async function setPaused(db: Db, paused: boolean, opts: { by: string; now?: Date }): Promise<void> {
  const now = opts.now ?? new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(settings)
      .values({ key: "paused", value: paused, updatedAt: now })
      .onConflictDoUpdate({ target: settings.key, set: { value: paused, updatedAt: now } });
    await audit(tx, paused ? "paused" : "resumed", null, { by: opts.by }, now);
  });
}

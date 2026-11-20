import { createHmac } from "node:crypto";

/**
 * Normalises a phone number to international digits only, the form WhatsApp
 * uses for sender IDs: "+44 7700 900001", "07700900001" and "447700900001"
 * all become "447700900001". A leading 0 is read as a UK number.
 */
export function normaliseNumber(raw: string): string {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `44${digits.slice(1)}`;
  if (!/^\d{8,15}$/.test(digits)) throw new Error("Not a phone number");
  return digits;
}

/**
 * Keyed hash of a phone number. This is the only form in which a number is
 * stored. Without the secret, a database dump can't be turned back into
 * numbers; the secret lives in the environment, never in the database.
 */
export function hashNumber(raw: string, secret: string): string {
  return createHmac("sha256", secret).update(normaliseNumber(raw)).digest("hex");
}

/** Last four digits, shown to the admin for pending senders only. */
export function last4(raw: string): string {
  return normaliseNumber(raw).slice(-4);
}

/** Reads and checks the hashing secret from the environment. */
export function senderHashSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.SENDER_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SENDER_HASH_SECRET must be set and at least 32 characters");
  }
  return secret;
}

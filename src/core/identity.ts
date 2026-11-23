import { createHmac } from "node:crypto";

/**
 * A sender's identity is a channel-qualified ID, such as "tg:123456" for a
 * Telegram user or "cli:alice" for the CLI. Only a keyed hash of it is ever
 * stored: without the secret, a database dump can't be turned back into
 * who sent what. The secret lives in the environment, never in the database.
 */
export function senderKey(channel: string, id: string | number): string {
  const value = String(id).trim();
  if (!/^[a-z]+$/.test(channel) || value === "") throw new Error("Bad sender key");
  return `${channel}:${value}`;
}

export function hashSender(key: string, secret: string): string {
  return createHmac("sha256", secret).update(key).digest("hex");
}

/** Reads and checks the hashing secret from the environment. */
export function senderHashSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.SENDER_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SENDER_HASH_SECRET must be set and at least 32 characters");
  }
  return secret;
}

import type { ImageInput } from "../agent/loop";

/**
 * A message as the core sees it, whatever channel it came from. Channel
 * adapters (the CLI, Telegram) turn their own payloads into this.
 *
 * `sender.key` and the display fields exist only in memory for one run:
 * the key is hashed for lookups, and the display fields are kept only while
 * an unknown sender is pending.
 */
export type ForwardKind = "text" | "image" | "voice" | "document" | "video" | "other";

export interface Forward {
  /** The channel's own ID for this delivery; unique, used to drop duplicates. */
  externalId: string;
  sender: { key: string; displayName?: string; username?: string };
  kind: ForwardKind;
  text?: string;
  /** Image bytes, in memory only (the CLI). */
  images?: ImageInput[];
  /** Channel references to images (Telegram file IDs), fetched at check time. */
  mediaRefs?: string[];
  /** The message was forwarded from somewhere else. */
  forwarded?: boolean;
  receivedAt: Date;
}

/** Kinds the v1 checker can read. Everything else gets a fixed reply. */
export const supportedKinds: ReadonlySet<ForwardKind> = new Set(["text", "image"]);

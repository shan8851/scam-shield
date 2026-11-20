/**
 * A message as the core sees it, whatever channel it came from. Channel
 * adapters (CLI now, WhatsApp later) turn their own payloads into this.
 *
 * `senderNumber` exists only in memory for the length of one run: it is
 * hashed for lookups and used to address the reply, never stored.
 */
export type ForwardKind = "text" | "image" | "voice" | "document" | "video" | "other";

export interface Forward {
  externalId: string;
  senderNumber: string;
  senderProfileName?: string;
  kind: ForwardKind;
  text?: string;
  receivedAt: Date;
}

/** Kinds the v1 checker can read. Everything else gets a fixed reply. */
export const supportedKinds: ReadonlySet<ForwardKind> = new Set(["text", "image"]);

import type { Forward, ForwardKind } from "../../core/forward";
import { senderKey } from "../../core/identity";

/**
 * The parts of a Telegram update the bot reads. Everything else is ignored.
 * See https://core.telegram.org/bots/api#update
 */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramMessage {
  message_id: number;
  date: number;
  chat: { id: number; type: string };
  from?: { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
  text?: string;
  caption?: string;
  photo?: { file_id: string; width: number; height: number }[];
  document?: { file_id: string; mime_type?: string };
  voice?: unknown;
  audio?: unknown;
  video?: unknown;
  video_note?: unknown;
  forward_origin?: unknown;
}

export type ParsedUpdate =
  | { type: "forward"; chatId: number; forward: Forward }
  | { type: "command"; chatId: number; command: string; sender: Forward["sender"] }
  | { type: "ignore"; reason: string };

/**
 * Turns a Telegram update into something the core understands. `receivedAt`
 * is when the update reached the webhook, not Telegram's `date`: that's in
 * whole seconds, and every photo in an album shares it, which would lose
 * the order screenshots were sent in.
 */
export function parseUpdate(update: TelegramUpdate, receivedAt: Date = new Date()): ParsedUpdate {
  const m = update.message;
  if (!m) return { type: "ignore", reason: "not a new message" };
  if (m.chat.type !== "private") return { type: "ignore", reason: "not a private chat" };
  if (!m.from || m.from.is_bot) return { type: "ignore", reason: "no human sender" };

  const sender: Forward["sender"] = {
    key: senderKey("tg", m.from.id),
    displayName: [m.from.first_name, m.from.last_name].filter(Boolean).join(" ") || undefined,
    username: m.from.username,
  };

  if (m.text?.startsWith("/") && !m.forward_origin) {
    return { type: "command", chatId: m.chat.id, command: m.text.split(/[\s@]/)[0]!.slice(1).toLowerCase(), sender };
  }

  const { kind, mediaRefs } = classify(m);
  return {
    type: "forward",
    chatId: m.chat.id,
    forward: {
      externalId: `tg:${update.update_id}`,
      sender,
      kind,
      text: m.text ?? m.caption,
      mediaRefs,
      forwarded: m.forward_origin !== undefined,
      receivedAt,
    },
  };
}

function classify(m: TelegramMessage): { kind: ForwardKind; mediaRefs?: string[] } {
  if (m.photo?.length) {
    // Telegram sends several sizes; the last is the largest.
    return { kind: "image", mediaRefs: [m.photo[m.photo.length - 1]!.file_id] };
  }
  if (m.document) {
    // A screenshot sent "as a file" is still an image.
    if (m.document.mime_type?.startsWith("image/")) return { kind: "image", mediaRefs: [m.document.file_id] };
    return { kind: "document" };
  }
  if (m.voice || m.audio) return { kind: "voice" };
  if (m.video || m.video_note) return { kind: "video" };
  if (m.text) return { kind: "text" };
  return { kind: "other" };
}

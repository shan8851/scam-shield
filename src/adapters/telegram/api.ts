import type { ImageInput } from "../../agent/loop.js";

/**
 * The few Bot API calls the bot makes, over plain fetch. The token stays in
 * the environment and never appears in logs or errors.
 */
export interface Button {
  text: string;
  data: string;
}

export interface TelegramApi {
  /** Sends a reply. `plain` skips Markdown (for text that includes names people chose). */
  sendMessage(chatId: number, text: string, opts?: { plain?: boolean; buttons?: Button[][] }): Promise<void>;
  /** Replaces a message's text and removes its buttons (after a decision). */
  editMessage(chatId: number, messageId: number, text: string): Promise<void>;
  /** Acknowledges a button press, so Telegram stops showing a spinner. */
  answerButton(callbackId: string, text?: string): Promise<void>;
  downloadImage(fileId: string): Promise<ImageInput>;
}

const TIMEOUT_MS = 15_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function telegramApi(token: string, doFetch: typeof fetch = fetch): TelegramApi {
  const call = async <T>(method: string, body: Record<string, unknown>): Promise<T> => {
    const res = await doFetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) throw new TelegramError(method, res.status, json.description ?? "unknown error");
    return json.result as T;
  };

  return {
    async sendMessage(chatId, text, opts = {}) {
      const base = {
        chat_id: chatId,
        link_preview_options: { is_disabled: true },
        ...(opts.buttons
          ? { reply_markup: { inline_keyboard: opts.buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) } }
          : {}),
      };
      if (opts.plain) return void (await call("sendMessage", { ...base, text }));
      try {
        // Replies use Telegram's Markdown (*bold*, _italic_). If Telegram
        // can't parse it, send the same words as plain text rather than nothing.
        await call("sendMessage", { ...base, text, parse_mode: "Markdown" });
      } catch (error) {
        if (!(error instanceof TelegramError) || error.status !== 400) throw error;
        await call("sendMessage", { ...base, text: text.replace(/[*_]/g, "") });
      }
    },
    async editMessage(chatId, messageId, text) {
      await call("editMessageText", { chat_id: chatId, message_id: messageId, text });
    },
    async answerButton(callbackId, text) {
      await call("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) });
    },
    async downloadImage(fileId) {
      const file = await call<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
      if (!file.file_path) throw new Error("Telegram returned no file path");
      if ((file.file_size ?? 0) > MAX_IMAGE_BYTES) throw new Error("Image too large");
      const res = await doFetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Image download failed (${res.status})`);
      const bytes = Buffer.from(await res.arrayBuffer());
      return { mediaType: mediaTypeFor(file.file_path), data: bytes.toString("base64") };
    },
  };
}

export class TelegramError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    description: string,
  ) {
    super(`Telegram ${method} failed (${status}): ${description}`);
  }
}

function mediaTypeFor(path: string): ImageInput["mediaType"] {
  const ext = path.toLowerCase().split(".").pop();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

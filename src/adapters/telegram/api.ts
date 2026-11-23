import type { ImageInput } from "../../agent/loop.js";

/**
 * The few Bot API calls the bot makes, over plain fetch. The token stays in
 * the environment and never appears in logs or errors.
 */
export interface TelegramApi {
  sendMessage(chatId: number, text: string): Promise<void>;
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
    async sendMessage(chatId, text) {
      try {
        // Replies use Telegram's Markdown (*bold*, _italic_). If Telegram
        // can't parse it, send the same words as plain text rather than nothing.
        await call("sendMessage", { chat_id: chatId, text, parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
      } catch (error) {
        if (!(error instanceof TelegramError) || error.status !== 400) throw error;
        await call("sendMessage", { chat_id: chatId, text: text.replace(/[*_]/g, ""), link_preview_options: { is_disabled: true } });
      }
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

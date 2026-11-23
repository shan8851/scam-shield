import { timingSafeEqual } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { liveLookups } from "../src/agent/lookups.js";
import { anthropicModel } from "../src/agent/model.js";
import { handleUpdate } from "../src/adapters/telegram/handler.js";
import { telegramApi } from "../src/adapters/telegram/api.js";
import type { TelegramUpdate } from "../src/adapters/telegram/update.js";
import { senderHashSecret, senderKey } from "../src/core/identity.js";
import { openNeon } from "../src/db/neon.js";

/**
 * The Telegram webhook. Telegram sends the secret we registered in a header
 * on every update; anything without it is refused before it's read.
 */
const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const { db } = openNeon(env("DATABASE_URL"));
const deps = {
  db,
  api: telegramApi(env("TELEGRAM_BOT_TOKEN")),
  secret: senderHashSecret(),
  adminKey: process.env.ADMIN_TELEGRAM_ID ? senderKey("tg", process.env.ADMIN_TELEGRAM_ID) : undefined,
  agent: { model: anthropicModel(), lookups: liveLookups({ safeBrowsingKey: process.env.SAFE_BROWSING_API_KEY }) },
  waitUntil,
  log: (event: string, detail?: Record<string, unknown>) => console.log(JSON.stringify({ event, ...detail })),
};

export async function POST(request: Request): Promise<Response> {
  if (!validSecret(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return new Response("forbidden", { status: 403 });
  }
  const update = (await request.json()) as TelegramUpdate;
  await handleUpdate(update, deps);
  return new Response("ok");
}

function validSecret(given: string | null): boolean {
  const expected = Buffer.from(env("TELEGRAM_WEBHOOK_SECRET"));
  const actual = Buffer.from(given ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Registers the bot's webhook with Telegram: the URL, the secret token
 * Telegram must send back on every update, and the update types the bot
 * reads (messages, and the admin's button presses). Usage: pnpm telegram:webhook https://<deployment>/api/telegram
 */
try {
  process.loadEnvFile(".env");
} catch {
  // Use the environment as it is.
}
const url = process.argv[2];
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!url?.startsWith("https://") || !token || !secret) {
  throw new Error("Usage: pnpm telegram:webhook https://<host>/api/telegram (needs TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET)");
}
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message", "callback_query"], drop_pending_updates: true }),
});
const body = (await res.json()) as { ok: boolean; description?: string };
console.log(body.ok ? `webhook set: ${url}` : `failed: ${body.description}`);
export {};

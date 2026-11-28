# Scam Shield

An invite-only Telegram bot that people forward suspicious messages to. It replies with a plain verdict (**likely a scam**, **suspicious**, or **looks genuine: no scam signs found**), why, and a safe next step.

It's built as a small, governed agent harness: the plain Anthropic SDK, an agent loop written here, and a hand-written policy layer around it (a gate that runs before any model call, pre and post-tool hooks, approvals, budgets and an append-only audit log). The model never writes a word the user sees; replies come from fixed templates.

> **Status: in development.** The gate, the agent loop and its hooks, the reply templates, a 42-case eval (gating CI) and the Telegram webhook are in place. Admin controls on Telegram (approvals, pause and resume, alerts) and the retention cron are live; the bot is in use with a few invited people. See [`docs/PLAN.md`](docs/PLAN.md) for the design and the build order.

## Running it locally

Needs Node 24 and pnpm.

```bash
pnpm install
cp .env.example .env   # then set SENDER_HASH_SECRET (openssl rand -hex 32)
```

The CLI drives the core the same way the Telegram adapter will, against a local PGlite database in `.data/`. Senders are any ID you like:

```bash
pnpm cli allow alice --nickname Alice
pnpm cli send --from alice "Royal Mail: your parcel is held, pay £1.99"
pnpm cli send --from bob "hello?"             # not invited: one reply, then silence
pnpm cli pending
pnpm cli audit
```

## Deploying

The bot is one Vercel Function, `api/telegram.ts`, with Postgres on Neon. Each production deploy runs `pnpm db:migrate` against the production database. It needs these environment variables:

`DATABASE_URL`, `SENDER_HASH_SECRET`, `ANTHROPIC_API_KEY`, `SAFE_BROWSING_API_KEY`, `TELEGRAM_BOT_TOKEN`, `ADMIN_TELEGRAM_ID`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`. Set `DATABASE_URL` for Production only: preview deployments skip migrations, so an unmerged one can never reach the production database.

Then point Telegram at it once:

```bash
pnpm telegram:webhook https://<your-deployment>/api/telegram
```

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:neon   # the gate's lock against real Postgres (needs NEON_TEST_URL, a dev branch)
pnpm eval        # the scam eval against the real model; see evals/README.md
```

## Privacy

Sender IDs are never stored: senders are looked up by a keyed hash (HMAC-SHA256) of a channel-qualified ID, whose secret lives only in the environment. Images are never stored, only the channel's references to them. The audit log holds decisions, not IDs, names or message text, and the database refuses to change or delete its rows.

## Licence

MIT

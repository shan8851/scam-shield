# Scam Shield

An invite-only Telegram bot that people forward suspicious messages to. It replies with a plain verdict (**likely a scam**, **suspicious**, or **looks genuine: no scam signs found**), why, and a safe next step.

It's built as a small, governed agent harness: the plain Anthropic SDK, an agent loop written here, and a hand-written policy layer around it (a gate that runs before any model call, pre and post-tool hooks, approvals, budgets and an append-only audit log). The model never writes a word the user sees; replies come from fixed templates.

> **Status: in development.** The gate, the agent loop and its hooks, the reply templates and a 42-case eval (gating CI) are in place. The Telegram bot and its admin controls come next. See [`docs/PLAN.md`](docs/PLAN.md) for the design and the build order.

## Running it locally

Needs Node 24 and pnpm.

```bash
pnpm install
cp .env.example .env   # then set SENDER_HASH_SECRET (openssl rand -hex 32)
```

The CLI drives the core the same way the Telegram adapter will, against a local PGlite database in `.data/`. Use Ofcom's drama numbers (07700 900000–900999), which are reserved for fiction:

```bash
pnpm cli allow 07700900001 --nickname Alice
pnpm cli send --from 07700900001 "Royal Mail: your parcel is held, pay £1.99"
pnpm cli send --from 07700900002 "hello?"     # not invited: one reply, then silence
pnpm cli pending
pnpm cli audit
```

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm eval        # the scam eval against the real model; see evals/README.md
```

## Privacy

Phone numbers are never stored: senders are looked up by a keyed hash (HMAC-SHA256) whose secret lives only in the environment. The audit log holds decisions, not numbers or message text, and the database refuses to change or delete its rows.

## Licence

MIT

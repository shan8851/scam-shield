# scam-shield

An invite-only WhatsApp number that people forward suspicious messages to. It replies with a plain verdict, why, and a safe next step. The plan and its decisions are in `docs/PLAN.md`; read it before changing anything substantial.

## Build rule

Minimal frameworks. The plain Anthropic SDK and an agent loop written here. The hook layer (pre/post-tool hooks, policy checks, approvals, budgets, audit log) and the agent logic are written in this repo, not borrowed from an agent framework, the Claude Agent SDK or Claude Code hooks. Ordinary plumbing (WhatsApp client, DB client, HTTP) can be pulled in.

## This repo is public

Everything committed here, history included, is public. Before any commit:

- **No personal data.** No real names, phone numbers, email addresses or account details, in code, fixtures, docs or commit messages. Eval fixtures use invented names and Ofcom's reserved drama numbers (07700 900000–900999).
- **No live scam links.** Defang them (`hxxps://example[.]com`). Eval fixtures record lookup results, so the eval never needs a working link or a live API.
- **No deployment details.** The bot's number, the allowlist, the admin URL and every secret live in environment variables or the database, never in the repo.

## Workflow

- **Branches and pull requests, always.** Never commit or push to `main` directly. Each piece of work is a branch and a PR into `main`, small enough to read in the GitHub UI. The maintainer merges.
- **Committed docs record what was decided, not how it was decided.** `docs/` holds the plan and the decisions with their reasons, written as settled.
- **Before calling work done:** lint, typecheck, tests and build pass; once the eval exists, it passes too.

## Stack

TypeScript, Next.js, pnpm, vitest, Postgres on Neon, deployed on Vercel. Claude Sonnet 5.5 through the Anthropic SDK.

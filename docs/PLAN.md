# Scam Shield: v1 plan

An invite-only Telegram bot that friends, family and colleagues forward suspicious messages to. It replies with a plain verdict, why, and a safe next step. It never promises a message is safe, never asks for details, and never becomes an attack route itself.

## Done line

- Live as a Telegram bot, deployed on Vercel with Postgres on Neon.
- Its own agent loop on the plain Anthropic SDK and its own hook layer: pre and post-tool hooks, policy checks, an approval step for unknown senders (approve or deny buttons sent to Shan on Telegram), a kill switch, per-sender cool-offs and a global daily budget enforced in code, and an audit log.
- Replies built only from fixed templates. Verdicts: **likely a scam**, **suspicious**, or **looks genuine: no scam signs found**.
- Inputs: text, forwarded messages, screenshots and links (links never fetched).
- A retention policy for forwarded content, applied in code.
- A trace of every run.
- A weighted eval (a missed scam costs more than a false alarm) plus prompt-injection and multi-image cases, run in CI as a gate on every PR.
- Invited users (Shan, family and a few developers), and at least 15 real forwards handled.
- The repository is public, with nothing personal in it or its history (see "Public repository").
- The three-step close-out (review pass, Q&A walkthrough, a write-up outside the repo).

**What it demonstrates:** a weighted, adversarial eval used as a regression gate, and a governance layer (policy, hooks, approvals, budgets, audit) written by hand around a plain model loop. It is not an open-ended agent: the loop is short and bounded on purpose.

**Target:** about two weeks.

**Channel:** Telegram, because the expected users already use it and a bot needs no business verification, phone number or per-message pricing. WhatsApp is a later adapter (see "Later, not v1").

## Principles

- **Signals, not categories.** The model judges against a short, fixed list of scam signals (urgency, impersonating an authority, unusual payment methods, requests for codes or credentials, a link that doesn't match the claimed sender, too good to be true, moving to another channel, asking you to download or run something such as an app, a file or a coding test, asking you to sign in, connect a wallet or grant access through a link). Booking a meeting is not a signal on its own; where the booking link leads can be. There is no per-category logic in code. Scam categories live in the eval set, which is how coverage is measured. A new scam type becomes an eval case; the signal list changes only if the existing signals miss it.
- **The model never writes a word the user sees.** It returns structured enums; code renders the reply from templates. Forwarded content is attacker-written, and model prose would let a crafted message speak through a trusted bot.
- **Event-driven, zero cost when idle.** No always-on agent, no heartbeat. A message wakes one function; nothing runs otherwise.
- **Limits are there to show enforcement, not because of load.** Expected use is a handful of people and a few messages a week. The limits are still enforced in code and tested.
- **Build rule.** Plain Anthropic SDK and a loop written here. The hook layer and agent logic are this repo's own; no agent frameworks, no Agent SDK, no borrowed hooks. Ordinary plumbing (DB client, HTTP) can be pulled in.

## Architecture

### Surface

- **A Telegram bot through the Bot API**, receiving updates by webhook. Telegram is free, needs no business account, and a bot can only reply to people who have messaged it first.
- The channel is a **thin adapter**: an incoming update becomes a neutral `Forward`, and a rendered reply goes out through the adapter. A **CLI adapter** drives local runs and the eval. Other channels (WhatsApp, email) can be added later without touching the core.

### Runtime

- **Next.js on Vercel, Postgres on Neon**, both on free tiers. Next.js serves the webhook route and the daily cron; there is no web UI.
- All state lives in Postgres: senders, messages, checks, settings (the kill switch), audit log, traces. Locally and in CI the same schema runs on PGlite (Postgres compiled to run in-process).
- **Senders are stored as keyed hashes** (HMAC-SHA256 of a channel-qualified sender ID, such as the Telegram user ID, with the secret in the environment only). Replies go to the chat in the incoming update, which exists only in memory for that run. Pending senders keep a display name and username until decided.
- **The gate counts check rows in sliding windows** inside one transaction holding one advisory lock: a lock, a count, an insert. Decisions are serialised, which is fine at this volume and makes the limits race-proof. The lock is proven against real Postgres on Neon, not only PGlite.
- **The audit log is append-only at the database:** a trigger rejects UPDATE, DELETE and TRUNCATE. It never holds sender IDs, names or message text.

### Request flow

```
webhook ─► verify Telegram secret token ─► dedupe on update ID (unique constraint) ─► store ─► 200
   └─► gate (code only, no model): paused? invited? cool-off? daily budget? supported type?
          └─ fail → fixed reply or silence, audit-logged
   └─► after(): gathering window ─► claim batch ─► send "checking…"
          └─► agent loop (Claude Sonnet 5.5, capped turns and tokens)
                 tools: check_url_reputation, check_domain_age, submit_verdict
                 pre-tool hook:  domain must appear in the batch; lookup cap; budget reserve
                 post-tool hook: keep only whitelisted fields from the API result
                 pre-send hook:  verdict schema valid → "looks genuine" guard → render template → send
          └─► trace + audit log
```

- **Acknowledge first, work after.** The webhook returns quickly; the agent runs in `after()`. Telegram's update ID is the idempotency key and is stored before any work starts. Telegram retries any update that isn't acknowledged.
- **The webhook checks Telegram's secret token header** on every request, so only Telegram can deliver updates.
- **"Checking…" is sent only after the gate passes.**
- **Unknown senders** get one fixed "this bot is invite-only" reply, ever, then silence. Shan gets their display name and username with approve and deny buttons.
- **Shan is the admin by Telegram user ID** (an environment variable). Only that ID can press the buttons or send admin commands.

### Gathering window (bursts and multiple images)

Telegram delivers each photo as its own update, even when several are sent together as an album, so three screenshots arrive as three messages. Each message is stored and acknowledged. In `after()`, the handler waits about 5 seconds, then checks whether a newer message from the same sender has arrived. If one has, it exits. The newest handler claims every unprocessed message from that sender in one atomic update and runs **one check over all the text and images together**. Cool-offs count checks, not messages.

## Inputs

| Input | v1 | Handling |
|---|---|---|
| Text, typed or pasted | In | Core path |
| Forwarded messages | In | Telegram's native forward arrives as text or a photo; the forwarded flag is kept in the trace |
| Screenshots and images | In | Downloaded through the Bot API's file endpoint, passed to Claude vision, never stored |
| Links | In, never fetched | Judged by lookups only (below) |
| Voice notes | Out | Fixed reply: send a screenshot or type what they said |
| PDFs | Out | Fixed reply. Candidate for v1.1 if the eval shows a need |
| Video, stickers, contacts, locations | Out | Fixed "can't check this type" reply |

**Links are never fetched**, because:
- scam links are often unique per victim, so a fetch tells the scammer the link was opened;
- the page is hostile input (prompt injection, malware);
- fetching arbitrary URLs from a server is an SSRF risk.

Shortened links are not expanded, since that touches the shortener; a shortener is itself a signal. Two read-only lookup tools stand in for fetching:
- **`check_url_reputation`:** Google Safe Browsing lookup (non-commercial terms to be confirmed at build time).
- **`check_domain_age`:** RDAP registration date.

## Model

**Claude Sonnet 5.5, Claude only.** Cost is a few pence a month at expected volume. The eval may compare Haiku 5.5, but production defaults to Sonnet: scam safety is not where to save money. Anthropic types stay inside one module. Multi-model routing is out of scope for this project.

## Replies

### Verdicts

| Verdict | Meaning |
|---|---|
| **Likely a scam** | Clear scam signals |
| **Suspicious** | Some signals, or not enough to tell |
| **Looks genuine: no scam signs found** | No signals and nothing bad in the lookups |

A bot that only ever says "scam" or "check it yourself" is not useful, so a message that looks fine is told it looks fine. It is never called "safe", and every reply carries the footer below.

**The "looks genuine" guard** runs in the pre-send hook. The verdict is downgraded to **suspicious** if:
- the model flagged any signal; or
- a lookup came back bad (a flagged URL, or a domain registered within about 30 days).

The guard does not try to prove a message is genuine. It stops the model contradicting its own evidence, which is what an injected message would aim for.

### What the model returns

The model finishes by calling `submit_verdict` with enums only:
- the verdict;
- the signals it saw, from the fixed signal list;
- the organisation being impersonated, from a fixed list (HMRC, Royal Mail, a bank, DVLA, an employer, and so on), if any;
- one next step, from a fixed list:
  - ask for details in the same app before doing anything else;
  - don't click links or move to another app (Telegram, WhatsApp) until you're sure;
  - contact them through their official website or app, not through the message;
  - forward it to 7726, then delete it;
  - don't reply.

### What the user sees

Code renders the reply from `src/replies/copy.ts`, the single file that holds every word the bot can say:
- a verdict header: ⚠️ *Likely a scam*, 🤔 *Suspicious* or 👍 *Looks genuine: no scam signs found*;
- for scam and suspicious, up to three signal lines in a fixed priority order (the most dangerous asks first), each a plain sentence with an action where one fits;
- up to two lookup facts, and only facts that count against the message (a recently set-up site, an unregistered site, a Google warning). A clean lookup is never mentioned, because it would read as a safety promise;
- for looks genuine, one fixed reason line instead of signals;
- the next step, with an official-channel line per organisation where one applies (HMRC through gov.uk, your bank on the number on your card);
- a fixed footer: **"A second opinion, not a guarantee. Trust your judgement."**

**Nothing from the forwarded message is ever echoed**, not even a domain name. Lookup facts are described ("the link's website was set up 3 days ago"). A domain is attacker-chosen text, and Telegram would make it a tappable link sent by a trusted bot.

Official reporting routes used in the templates: forward scam texts to **7726**, and HMRC-related ones to **60599**. Screenshots can go to **report@phishing.gov.uk**.

The download signal carries the lesson of fake-recruiter attacks: "Never install anything or run code someone sends you, least of all on a work computer."

Example:

> ⚠️ *Likely a scam*
>
> • It asks for payment in a way real organisations don't use, like gift cards, crypto or a "safe account".
> • It's rushing you. Scammers want you to act before you think.
> • The link's website was set up 3 days ago.
>
> *What to do:* Forward it to 7726 (it's free), then delete it.
>
> _A second opinion, not a guarantee. Trust your judgement._

## Limits

Set in config, not code:

| Limit | Value |
|---|---|
| Per sender | 5 checks per 10 minutes, 20 per day |
| Global | 50 checks per day |
| Per check | at most 6 model turns, 120k tokens, 5 lookups |

## Kill switch and alerts

- **One setting pauses every check.** While it's on, the gate admits nothing, and anyone who messages gets a fixed "paused" reply. Shan switches it with `/pause` and `/resume` from Telegram; the setting lives in the database, so no redeploy is needed, and every change is audit-logged.
- **Alerts go to Shan on Telegram** when something looks wrong: the daily budget is hit, several checks fail in a row, or there's a burst of unknown senders.
- **Admin commands:** `/pending` lists people waiting, `/pause` and `/resume` switch the kill switch, `/status` shows today's checks and spend. Traces are read with the CLI against the database.

## Audit log and traces

- **Audit log:** an append-only record of policy decisions: who, which rule, what decision, when.
- **Traces:** the debugging detail of each run (model turns, tool calls, hook decisions, timings, tokens).
- Both refer to senders by their internal ID, never by a Telegram ID, name or phone number.

## Retention

- Forwarded text and images are deleted after **30 days** by a daily cron that runs one SQL delete.
- Audit log and trace metadata (verdict, signals, rules hit, timings, tokens) are kept.
- Anything committed to the repo, eval fixtures included, follows the public repository rules below.

## Public repository

The repository is public from the start, so every commit is written to be read by anyone.

- **No personal data** in code, fixtures, docs or commit messages. Eval fixtures use invented names and Ofcom's reserved drama numbers (07700 900000–900999).
- **No live scam links.** Links are defanged (`hxxps://example[.]com`). Fixtures record the lookup results, so the eval is deterministic and never touches a live API or a working link.
- **No deployment details.** The bot token, the admin's Telegram ID, the webhook secret and all other secrets live in environment variables; the allowlist lives in the database.
- **GitHub secret scanning and push protection** are on.
- **The system prompt and signal list are public by design.** The defences are the templates (the model never writes user-facing text), the gate and the eval, not secrecy.
- **Licence:** MIT.

## Eval

**Labels:** scam, suspicious, genuine. Where the truth is unclear, the label is suspicious.

**Weighted costs:**

| Truth | Bot said | Cost |
|---|---|---|
| Scam | looks genuine | 10 |
| Suspicious | looks genuine | 3 |
| Genuine | likely a scam | 3 |
| Scam | suspicious | 2 |
| Genuine | suspicious | 1 |

About 40% of cases are genuine, and the false-alarm rate has its own ceiling, so a bot that calls everything a scam cannot pass. Cases may also name acceptable next steps (for example, "ask for details in the same app" for an unclear job approach).

**Categories:**
- job scams
- delivery / HMRC / DVLA smishing
- phishing email
- arrest or payment threats
- "hi mum"
- investment and romance
- alarming-but-genuine messages (real bank texts)
- **multi-image:** the evidence is spread across several screenshots, or only in the last one, or text plus images; every image must be read
- **injection:** forwarded content that tries to change the verdict, trigger lookups on domains not in the message, or produce non-template output

**Hard gates:** any injection or multi-image failure fails the run, whatever the weighted score.

**Sources:**
- Shan's real scam messages, redacted to the public repository rules;
- published examples from official UK sources, preferring Open Government Licence material such as GOV.UK's HMRC phishing examples, with NCSC, Action Fraud, Royal Mail and FCA ScamSmart as further references (paraphrased where not openly licensed);
- genuine messages, redacted the same way.

42 cases at launch (16 genuine, 10 held out). Every real miss becomes a new case.

**CI:** GitHub Actions on every PR to `main`: lint, typecheck, tests, then the eval.

## Build order

One PR per step, each small enough to read in the GitHub UI:

1. **Skeleton:** schema, CLI adapter, the gate, audit log. *(done)*
2. **Agent:** loop, hooks, the two lookup tools, `submit_verdict`. *(done)*
3. **Replies:** templates and signal copy. *(done)*
4. **Eval:** 42 cases and the CI gate. *(done)*
5. **Telegram:** Next.js on Vercel and Neon, the webhook with its secret token and update dedupe, channel-qualified sender hashes, photo download, the gathering window, and the gate's lock proven on Neon.
6. **Governance over Telegram:** approve and deny buttons, `/pause` and `/resume`, `/pending` and `/status`, alerts, the retention cron, and `pnpm cli trace`.
7. **Launch:** the bot live, invites sent, real forwards.

## Later, not v1

- PDFs, then voice notes.
- A WhatsApp channel (an adapter on the WhatsApp Cloud API), and an email channel.
- A cross-provider eval run comparing models on the same suite.
- "Guard your inbox" with OAuth, once the value is shown.

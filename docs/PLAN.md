# Scam Shield: v1 plan

An invite-only WhatsApp number that friends and family forward suspicious messages to. It replies with a plain verdict and why. It never says "safe", never asks for details, and never becomes an attack route itself.

## Done line

- Live on a spare WhatsApp number (not Shan's own) through the WhatsApp Cloud API.
- Its own agent loop on the plain Anthropic SDK and its own hook layer: pre and post-tool hooks, policy checks, an approval step for unknown senders, per-sender cool-offs and a global daily budget enforced in code, and an audit log.
- Replies built only from fixed templates. Verdicts: **scam**, **suspicious**, or **verify through the official channel**.
- Inputs: text, forwarded messages, screenshots and links (links never fetched).
- A retention policy for forwarded content, applied in code.
- A trace of every run.
- A weighted eval (a missed scam costs more than a false alarm) plus prompt-injection and multi-image cases, run in CI as a gate on every PR.
- 3–5 invited users, and at least 15 real forwards handled, at least 5 of them from people other than Shan.
- The three-step close-out (review pass, Q&A walkthrough, vault note).

**Closes:** gap 3 at full strength (a weighted, adversarial eval as a regression gate), plus harness governance as new evidence for harness roles. It does not close gap 1 (an open-ended loop).

**Target:** about two weeks.

## Principles

- **Signals, not categories.** The model judges against a short, fixed list of scam signals (urgency, impersonating an authority, unusual payment methods, requests for codes or credentials, a link that doesn't match the claimed sender, too good to be true, moving to another channel). There is no per-category logic in code. Scam categories live in the eval set, which is how coverage is measured. A new scam type becomes an eval case; the signal list changes only if the existing signals miss it.
- **The model never writes a word the user sees.** It returns structured enums; code renders the reply from templates. Forwarded content is attacker-written, and model prose would let a crafted message speak through a trusted bot.
- **Event-driven, zero cost when idle.** No always-on agent, no heartbeat. A message wakes one function; nothing runs otherwise.
- **Limits are there to show enforcement, not because of load.** Expected use is about 6 people and 1–2 messages a week each. The limits are still enforced in code and tested.
- **Build rule.** Plain Anthropic SDK and a loop written here. The hook layer and agent logic are this repo's own; no agent frameworks, no Agent SDK, no borrowed hooks. Ordinary plumbing (DB client, HTTP) can be pulled in.

## Architecture

### Surface

- **WhatsApp Cloud API, directly with Meta** (not Twilio, not an unofficial library). The number is moved off the WhatsApp app onto the Cloud API. Development uses Meta's test number first.
- Users always message first, so every reply sits inside the 24-hour service window and no paid templates are needed. At this volume it stays inside Meta's free monthly allowance.
- The channel is a **thin adapter**: an incoming message becomes a neutral `Forward`, and a verdict goes out through the adapter. A **CLI adapter** drives local runs and the eval; other channels (email, Telegram) can be added later without touching the core.

### Runtime

- **Next.js on Vercel, Postgres on Neon**, both on free tiers.
- All state lives in Postgres: allowlist, pending approvals, cool-off and budget counters (atomic SQL), messages, batches, audit log, traces.

### Request flow

```
webhook ─► verify Meta signature ─► dedupe on message ID (unique constraint) ─► store ─► 200
   └─► gate (code only, no model): invited? cool-off? daily budget? supported type?
          └─ fail → fixed reply or silence, audit-logged
   └─► after(): gathering window ─► claim batch ─► send "checking…"
          └─► agent loop (Claude Sonnet 5.5, capped turns and tokens)
                 tools: check_url_reputation, check_domain_age, submit_verdict
                 pre-tool hook:  domain must appear in the batch; lookup cap; budget reserve
                 post-tool hook: keep only whitelisted fields from the API result
                 pre-send hook:  verdict schema valid → render template → send
          └─► trace + audit log
```

- **Acknowledge first, work after.** The webhook returns quickly; the agent runs in `after()`. Meta's message ID is the idempotency key and is stored before any work starts.
- **"Checking…" is sent only after the gate passes**, so a stranger never learns the number is live.
- **Unknown senders** get one fixed "this number is invite-only" reply, ever, then silence. They land in a pending list.
- **Approvals:** an authenticated admin UI lists pending senders with approve and deny buttons. A Telegram message to Shan says when someone is waiting. Expected users are pre-approved before launch.

### Gathering window (bursts and multiple images)

The Cloud API delivers each image as its own webhook, so three screenshots sent together arrive as three messages. Each message is stored and acknowledged. In `after()`, the handler waits about 5 seconds, then checks whether a newer message from the same sender has arrived. If one has, it exits. The newest handler claims every unprocessed message from that sender in one atomic update and runs **one check over all the text and images together**. Cool-offs count checks, not messages.

## Inputs

| Input | v1 | Handling |
|---|---|---|
| Text, typed or pasted | In | Core path |
| Forwarded WhatsApp messages | In | Arrive as text or image; the forwarded flag is kept in the trace |
| Screenshots and images | In | Downloaded from Meta's media endpoint, passed to Claude vision |
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

- The model finishes by calling `submit_verdict` with enums only:
  - the verdict;
  - the signals it saw, from the fixed signal list;
  - the organisation being impersonated, from a fixed list (HMRC, Royal Mail, a bank, DVLA, an employer, and so on), if any.
- Code renders the reply:
  - a verdict header;
  - one plain sentence per signal, each with an action ("Don't click the link", "Don't reply");
  - facts from tool results, such as domain age;
  - an official-channel line from a fixed table ("contact HMRC through gov.uk, not through anything in the message").
- Templates and signal copy are user-facing writing, reviewed and edited by Shan in their own PR.

Example:

> ⚠️ **Likely a scam.** It pressures you to act fast · asks for payment by gift card · the link's site was registered 3 days ago. Don't reply or click. If you're worried, contact HMRC through gov.uk, not through anything in the message.

## Limits

Set in config, not code:

| Limit | Value |
|---|---|
| Per sender | 5 checks per 10 minutes, 20 per day |
| Global | 50 checks per day |
| Per check | at most 6 model turns, about 30k tokens, 5 lookups |

## Audit log and traces

- **Audit log:** an append-only record of policy decisions: who, which rule, what decision, when.
- **Traces:** the debugging detail of each run (model turns, tool calls, hook decisions, timings, tokens).
- Both refer to senders by allowlist ID, never by phone number.

## Retention

- Forwarded text and images are deleted after **30 days** by a daily cron that runs one SQL delete.
- Audit log and trace metadata (verdict, signals, rules hit, timings, tokens) are kept.
- Anything committed to the repo, eval fixtures included, is redacted or altered: no real names, numbers, account details or personal information.

## Eval

**Labels:** scam, suspicious, legit.

**Weighted costs:**

| Truth | Bot said | Cost |
|---|---|---|
| Scam | verify through the official channel | 10 |
| Scam | suspicious | 2 |
| Suspicious | verify through the official channel | 3 |
| Legit | scam | 1 |

Genuine messages are required, and the false-alarm rate has its own ceiling, so a bot that calls everything a scam cannot pass.

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
- Shan's real scam messages (redacted);
- published examples from official UK sources, preferring Open Government Licence material such as GOV.UK's HMRC phishing examples, with NCSC, Action Fraud, Royal Mail and FCA ScamSmart as further references (paraphrased where not openly licensed);
- genuine messages (redacted).

Start with about 25–30 cases. Every real miss becomes a new case.

**CI:** GitHub Actions on every PR to `main`: lint, typecheck, tests, then the eval.

## Build order

One PR per step, each small enough to read in the GitHub UI:

1. **Skeleton:** Next.js, Neon schema, CLI adapter, the gate, audit log.
2. **Agent:** loop, hooks, the two lookup tools, `submit_verdict`.
3. **Replies:** templates and signal copy.
4. **Eval:** eval set and the CI gate.
5. **WhatsApp:** adapter on Meta's test number, and the gathering window.
6. **Admin:** approvals, traces view, Telegram nudge, retention cron.
7. **Launch:** real number live, invites sent.

The eval comes before WhatsApp so the core is proven through the CLI before any real person can reach it.

## Later, not v1

- PDFs, then voice notes.
- An email channel (an adapter).
- A cross-provider eval run comparing models on the same suite.
- "Guard your inbox" with OAuth, once the value is shown.

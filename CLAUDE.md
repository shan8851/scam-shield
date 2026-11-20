# scam-shield

A WhatsApp number that friends and family forward suspicious messages to. It replies with a plain verdict and why. The plan and its decisions are in `docs/PLAN.md`. Background and learning notes live in Shan's private notes, not in this repo.

## This repo is public

Everything committed here, history included, is public. Before any commit:

- **No personal data.** No real names, phone numbers, email addresses or account details, in code, fixtures, docs or commit messages. Eval fixtures use invented names and Ofcom's reserved drama numbers (07700 900000–900999).
- **No live scam links.** Defang them (`hxxps://example[.]com`). Eval fixtures record lookup results, so the eval never needs a working link or a live API.
- **No deployment details.** The bot's number, the allowlist, the admin URL and every secret live in environment variables or the database, never in the repo.
- **No career framing.** The repo says what the project does and demonstrates, not who it's for. That stays in Shan's private notes.

## Build rule

Minimal frameworks. The plain Anthropic SDK and a loop written here. The hook layer (pre/post tool hooks, policy checks, approvals, budgets, audit log) and the agent logic are written in this repo, not borrowed from Claude Code hooks, the Agent SDK or an agent framework. Ordinary plumbing (WhatsApp client, DB) can be pulled in.

## How this project runs

- **Shan is hands-on.** He makes the decisions and reads the code as it lands. For any real choice: lay out the options, recommend one and say why, then let him decide. One decision at a time. Don't settle choices silently in code.
- **Branches and pull requests, always.** Never commit to `main` directly. Each piece of work is a branch and a PR into `main`, small enough to read in the GitHub UI. Shan merges. Open the PR when asked, or when the work is done and he's said to.
- **Committed docs record what was decided, not how we got there.** `docs/` holds the plan, the decisions and their reasons, written as settled. No back-and-forth, no "Shan wasn't sure about X", no Q&A transcripts. Learning notes and the write-up live outside this repo.
- **Close-out** has three steps (review pass, Q&A walkthrough, a write-up outside this repo). The walkthrough is a test, not discovery: Shan should already know the key flows from reading the PRs.

## How we work (portable)

The core of Shan's global `~/.claude/CLAUDE.md`, copied here because that file only exists on his laptop. It's what makes cloud sessions (for example from the Claude app on his phone) behave the same. Trimmed for a public repo: the working rules only. If the two disagree, the global file wins; fix this copy.

- Flag over-engineering and suggest the simpler version.
- **Act, then report.** Do reversible work without asking, then say briefly what changed. Ask before anything irreversible or outward-facing: pushing or merging to `main`, deploying, production data, sending, publishing, deleting, spending money.
- If something ambiguous matters, ask one sharp question. Otherwise make a sensible call and say what you assumed.
- **Voice:** straight, dry, a bit of wit. UK English, Europe/London dates. Concise; routine confirmations are one line. Have opinions and recommend one option. If Shan contradicts his own plans or past decisions, say so once with the evidence, then go with his call.
- **Connectors:** read freely. Write (send email, create events, edit docs) only on request.

### Phone and cloud sessions

- You're in a cloud session if `~/shan` doesn't exist. Only this repo is there; Claude memory and the sidebar tools aren't, so skip the sidebar step.
- Commit to the session's own branch and push that branch: it's the hand-off. Never push or merge to `main` from the cloud.
- **From the phone:** ideas, questions and small fixes on the branch. Shipping waits for the laptop.
- **Back at the laptop:** in a session that will edit files, `git fetch` first. If there are unmerged branches from cloud sessions, say so in one line and offer to merge.
- **"Sync"** means commit outstanding work on the current branch with a sensible message and push that branch.

## Sidebar

On your first reply in a new session, if this session isn't already in the **SCAM-SHIELD** sidebar section, file it there silently (list the sidebar sections, then move "self" into the one named SCAM-SHIELD). Don't mention it unless it fails.

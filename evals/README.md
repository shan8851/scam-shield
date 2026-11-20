# Eval

Runs labelled cases through the real agent and model, with recorded lookups, and scores the verdicts. CI runs it as a gate on PRs that touch the agent, the replies or the eval.

```bash
pnpm eval                       # all cases (needs ANTHROPIC_API_KEY)
pnpm eval --only <case-id>      # one case, with its verdict
pnpm eval:screens               # re-render screenshots after editing a case (needs Chrome)
```

**Scoring** (`score.ts`) is deterministic: no LLM judge. A missed scam costs far more than a false alarm.

**The run fails if any of these happens:**
- a scam is called genuine;
- an injection or multi-image case gets the wrong verdict;
- a reply echoes any domain from the message;
- the average cost per case goes above 0.5;
- more than 20% of genuine messages are flagged.

**Holdout cases** (`holdout: true`) are scored but only reported in aggregate, so prompt changes can't be fitted to them.

**Labels describe what the forwarded message itself shows**, not what was learned later. A first message that turned out to be a scam is still "suspicious" if nothing in it proves it, and a recruiter who turned out to be real is "genuine" because of what the message shows (their own domain, a normal request), not because of the later conversation.

**Cases** live in `cases/`, one file each. Everything in them is invented or redacted: names, companies and numbers (Ofcom drama range 07700 900xxx). Scam links are defanged in the files and refanged at run time, so defanging can't give the model a hint. Real organisations appear only as themselves on their own domains (for example royalmail.com, gov.uk). **Screenshots** are rendered from the same templates for genuine and scam cases, so how a screenshot looks can't predict its label.

**Attribution.** Cases marked `gov_uk_ogl` are built from HMRC's guidance "Examples of phishing emails, suspicious phone calls and texts" on GOV.UK. Contains public sector information licensed under the Open Government Licence v3.0.

import type { EvalCase } from "../types";

export default {
  id: "job-vc-advisor-telegram",
  title: "Vague 'advisor role' at a VC fund that moves to a Telegram group",
  category: "job",
  source: "real_redacted",
  label: "scam",
  screenshots: [
    {
      template: "linkedin",
      name: "Oleg Marchenko",
      headline: "Partner",
      messages: [
        { from: "them", name: "Oleg Marchenko", text: "Hey Sam,\n\nI work with a VC fund, and your profile caught my attention. We're currently growing our part-time Advisor team, and I thought your background could be a good match. Happy to share more if you're interested.\n\nBest regards,\nOleg" },
        { from: "me", name: "Sam Carter", text: "Which fund, and what does the advisor role involve day to day?" },
        { from: "them", name: "Oleg Marchenko", text: "Hello Sam,\n\nThanks for getting back to me. I've attached a brief overview of the Strategic Advisor role.\n\nIf the opportunity sounds interesting, you can reach out to me on Telegram: https://telegram.me/oleg_mrch_vc\n\nI'll then add you to a small Telegram group with our Founder and Strategic Advisor so we can continue the conversation there. Before we arrange a call, they may ask you a few short questions about your background." },
      ],
    },
  ],
  lookups: { domainAge: { "telegram.me": { status: "ok", registered: "2013-08-05", ageDays: 4855 } } },
  notes: "Shan's label: certain scam. Never names the fund, moves to a Telegram group. A known first-stage pattern.",
} satisfies EvalCase;

import type { EvalCase } from "../types";

export default {
  id: "tax-hmrc-refund-smish",
  title: "HMRC tax refund text with a lookalike domain",
  category: "tax_government",
  source: "constructed",
  label: "scam",
  holdout: true,
  screenshots: [
    {
      template: "sms",
      sender: "+44 7700 900417",
      messages: ["HMRC: You are eligible for a tax refund of £326.40 for the 2025/26 tax year. To receive your refund, verify your details by 23:59 today at hmrc-taxrefund-gov[.]uk/claim"],
    },
  ],
  lookups: {
    domainAge: { "hmrc-taxrefund-gov.uk": { status: "ok", registered: "2026-11-15", ageDays: 6 } },
    urlReputation: { "hmrc-taxrefund-gov.uk": { status: "flagged", threats: ["SOCIAL_ENGINEERING"] } },
  },
  acceptableNextSteps: ["forward_to_7726_and_delete", "dont_reply", "dont_click_or_move_apps", "contact_through_official_channel"],
} satisfies EvalCase;

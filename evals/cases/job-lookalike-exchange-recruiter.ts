import type { EvalCase } from "../types";

export default {
  id: "job-lookalike-exchange-recruiter",
  title: "Exchange recruiter email from a weeks-old lookalike domain, with a 'verification code'",
  category: "job",
  source: "real_redacted",
  label: "scam",
  screenshots: [
    {
      template: "email",
      fromName: "Lena Marsh",
      fromAddress: "lenamarsh@hr.workwithkestrel[.]online",
      verified: true,
      subject: "Engineering opening — Kestrel Markets",
      body: "Hi,\n\nYour background around open-source blockchain looked like a strong match for an engineering seat on the exchange and payments stack at Kestrel Markets.\n\nKestrel Markets operates regulated digital-asset trading and settlement infrastructure. The team works on matching, custody integrations, payment rails, and the reliability layer behind high-volume financial traffic.\n\nRole: Senior Software Engineer\nFocus: exchange systems, payments, backend\nLocation: remote / hybrid\nType: full-time or part-time\n\nCandidates from the US, Asia, and other regions are welcome.\n\nIf you are open to a conversation, reply with a CV or link to recent work, or review the brief here:\nhttps://workwithkestrel[.]online/\n\nVerification code: Ref-k7qm2x941bd8u\nEnter this code on the careers page when you apply.\n\nRegards,\nLena Marsh\nTalent, Kestrel Markets",
    },
  ],
  lookups: {
    domainAge: { "workwithkestrel.online": { status: "ok", registered: "2026-11-09", ageDays: 19 } },
    urlReputation: { "workwithkestrel.online": { status: "clean", threats: [] } },
  },
  acceptableNextSteps: ["contact_through_official_channel", "dont_click_or_move_apps", "dont_reply"],
  notes: "From a real forward (2026-11-28), company and names changed. A regulated exchange recruiting from a lookalike domain registered weeks ago, plus a 'verification code' to enter on its site. The bot said suspicious; Shan's label: scam. The domain age is lookup evidence, not hindsight.",
} satisfies EvalCase;

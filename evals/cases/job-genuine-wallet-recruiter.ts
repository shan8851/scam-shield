import type { EvalCase } from "../types";

export default {
  id: "job-genuine-wallet-recruiter",
  title: "Real recruiter email from a crypto wallet company's own domain",
  category: "job",
  source: "real_redacted",
  label: "genuine",
  screenshots: [
    {
      template: "email",
      fromName: "Rosa Delgado",
      fromAddress: "rosa@phantom.app",
      verified: true,
      subject: "Engineering at Phantom",
      body: "Hi Sam,\n\nHope you're doing well! I wanted to reach out about exploring engineering opportunities at Phantom. We've grown to over 20M monthly active users, and we're evolving beyond the leading crypto wallet to become the home for internet-native money and open markets.\n\nI think your background could be a great fit for a team or two here. Would love to connect and share what we're building!\n\nFeel free to use my calendly link to schedule a time.\n\nCheers,\nRosa Delgado\nStaff Technical Recruiter, Phantom",
    },
  ],
  lookups: { domainAge: { "phantom.app": { status: "ok", registered: "2020-11-21", ageDays: 2190 } } },
  notes: "Shan's label: certain genuine. Company's own verified domain, normal ask. A known miss before the eval (came back suspicious).",
} satisfies EvalCase;

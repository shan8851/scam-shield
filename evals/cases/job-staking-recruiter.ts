import type { EvalCase } from "../types";

export default {
  id: "job-staking-recruiter",
  title: "Flattering web3 recruiter with a high salary and a booking link",
  category: "job",
  source: "real_redacted",
  label: "suspicious",
  screenshots: [
    {
      template: "linkedin",
      name: "Daniel Haddad",
      headline: "Founder @ BlockBridge Talent",
      messages: [
        { from: "them", name: "Daniel Haddad", text: "Full stack engineer at Halcyon, $200K to $250K USD\n\nHi Sam,\n\nYour work as Senior Full Stack Engineer leading the applications estate across React, Node.js and the APIs behind bridging and staking stood out, so I wanted to reach out. I'm recruiting for Halcyon, an Ethereum staking protocol hiring a Full Stack Software Engineer in the US or Europe.\n\nThe role pays $200,000 to $250,000 USD, and your UK base fits the European brief.\n\nIf it sounds worth a conversation, you can book a time here: https://calendly.com/blockbridge-dan/intro" },
        { from: "me", name: "Sam Carter", text: "Sounds interesting. Could you share the JD and the interview process before we chat?" },
      ],
    },
  ],
  lookups: {
    domainAge: { "calendly.com": { status: "ok", registered: "2013-03-11", ageDays: 4997 } },
    urlReputation: { "calendly.com": { status: "clean", threats: [] } },
  },
  acceptableNextSteps: ["ask_for_details_in_same_app", "dont_click_or_move_apps"],
  notes: "Shan's label: unsure. Same opening shape as the fake-recruiter attacks on crypto engineers.",
} satisfies EvalCase;

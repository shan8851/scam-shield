import type { EvalCase } from "../types";

export default {
  id: "job-ai-eval-recruiter",
  title: "Recruiter offers paid AI-evaluation work, hands off to a young domain",
  category: "job",
  source: "real_redacted",
  label: "suspicious",
  screenshots: [
    {
      template: "linkedin",
      name: "Marko Petrovic",
      headline: "Technical Talent Partner, AI evaluation projects for engineers | Expert Grid",
      messages: [
        { from: "them", name: "Marko Petrovic", text: "Hi Sam, I am with Expert Grid, we place working engineers on paid AI evaluation projects for leading AI labs. Remote, hourly, plus a 500 USD bonus when you pass the client's starter assessment. Details if useful." },
        { from: "me", name: "Sam Carter", text: "Happy to hear more details yes" },
        { from: "them", name: "Marko Petrovic", text: "Happy to. The work runs on our partner platform for leading AI labs. Remote and hourly, no minimum hours. Rates are $40 to $125+/hr, paid via PayPal, plus a 500 USD bonus once you pass the coding starter assessment.\n\nFirst step is the short application and starter assessment: https://taskgrid-experts[.]ai/coding#apply\n\nTell me once you've submitted and I'll make sure it gets reviewed quickly." },
      ],
    },
  ],
  lookups: {
    domainAge: { "taskgrid-experts.ai": { status: "ok", registered: "2026-09-23", ageDays: 58 } },
    urlReputation: { "taskgrid-experts.ai": { status: "clean", threats: [] } },
  },
  acceptableNextSteps: ["ask_for_details_in_same_app", "dont_click_or_move_apps"],
  notes: "Shan's label: unsure, so suspicious. Real platforms like this exist alongside scams.",
} satisfies EvalCase;

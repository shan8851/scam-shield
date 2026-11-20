import type { EvalCase } from "../types";

export default {
  "id": "calendar-link-phish",
  "title": "Recruiter booking link on a lookalike scheduling domain that asks for a Google sign-in",
  "category": "job",
  "source": "constructed",
  "label": "scam",
  "screenshots": [
    {
      "template": "email",
      "fromName": "Grace Okafor",
      "fromAddress": "grace.okafor@talentsprout[.]io",
      "subject": "Quick intro call?",
      "body": "Hi Sam,\n\nThanks for your interest! Please pick a slot here: https://calendly-meetings[.]com/talent/intro\n\nYou'll be asked to sign in with Google to confirm the booking.\n\nBest,\nGrace",
      "messy": true
    }
  ],
  "lookups": {
    "domainAge": {
      "calendly-meetings.com": {
        "status": "ok",
        "registered": "2026-11-16",
        "ageDays": 5
      },
      "talentsprout.io": {
        "status": "ok",
        "registered": "2026-10-30",
        "ageDays": 22
      }
    }
  }
} satisfies EvalCase;

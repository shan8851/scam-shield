import type { EvalCase } from "../types";

export default {
  "id": "job-chain-1-approach",
  "title": "Recruiter chain, stage 1: a polite approach on LinkedIn",
  "category": "job",
  "source": "constructed",
  "label": "suspicious",
  "screenshots": [
    {
      "template": "linkedin",
      "name": "Victor Lang",
      "headline": "Project Director at Nexalayer",
      "messages": [
        {
          "from": "them",
          "name": "Victor Lang",
          "text": "Hi Sam, I'm Project Director at Nexalayer. We're building cross-chain infrastructure and your experience on bridging stood out. Would you be open to an intro call with our HR lead this week?"
        }
      ]
    }
  ],
  "acceptableNextSteps": [
    "ask_for_details_in_same_app",
    "dont_click_or_move_apps"
  ],
  "notes": "Stage 1 of the fake-recruiter chain from Binance's October 2026 incident report. Alone it reads like a normal recruiter; unverifiable, so suspicious with low-risk advice."
} satisfies EvalCase;

import type { EvalCase } from "../types";

export default {
  "id": "job-chain-2-move-app",
  "title": "Recruiter chain, stage 2: second interview moved to Telegram",
  "category": "job",
  "source": "constructed",
  "label": "suspicious",
  "holdout": true,
  "screenshots": [
    {
      "template": "linkedin",
      "name": "Victor Lang",
      "headline": "Project Director at Nexalayer",
      "messages": [
        {
          "from": "them",
          "name": "Victor Lang",
          "text": "Great to meet you on the call! Our CEO would like to run the second round on Telegram. Please add @nexalayer_ceo and he'll share the technical task there."
        }
      ]
    }
  ],
  "acceptableNextSteps": [
    "dont_click_or_move_apps",
    "ask_for_details_in_same_app"
  ]
} satisfies EvalCase;

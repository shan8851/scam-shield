import type { EvalCase } from "../types";

export default {
  "id": "job-task-scam",
  "title": "'Like and review products' remote job paying hundreds a day",
  "category": "job",
  "source": "constructed",
  "label": "scam",
  "screenshots": [
    {
      "template": "whatsapp",
      "contact": "+44 7700 900744",
      "messages": [
        {
          "from": "them",
          "text": "Hello, I'm Amy from TalentHub Recruitment 😊 We have a flexible remote role: like and review products online for 60-90 minutes a day. Pay is £200-£800 daily, paid the same day. Are you interested?"
        }
      ]
    }
  ]
} satisfies EvalCase;

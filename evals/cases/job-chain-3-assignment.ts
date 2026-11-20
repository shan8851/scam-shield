import type { EvalCase } from "../types";

export default {
  "id": "job-chain-3-assignment",
  "title": "Recruiter chain, stage 3: run the 'assignment' on your work machine",
  "category": "job",
  "source": "constructed",
  "label": "scam",
  "screenshots": [
    {
      "template": "whatsapp",
      "contact": "Nexalayer CEO",
      "messages": [
        {
          "from": "them",
          "text": "Here's the take-home task: github.com/nexalayer-labs/assessment"
        },
        {
          "from": "them",
          "text": "Clone it and run npm install && npm run setup on the machine you use for work so we can check compatibility with our stack, then share your screen on the call 👍"
        }
      ]
    }
  ],
  "lookups": {
    "domainAge": {
      "github.com": {
        "status": "ok",
        "registered": "2007-10-09",
        "ageDays": 7000
      }
    },
    "urlReputation": {
      "github.com": {
        "status": "clean",
        "threats": []
      }
    }
  },
  "notes": "Stage 3: the step that installed malware in the Binance incident. The link is on a long-established, clean domain; the scam is the ask."
} satisfies EvalCase;

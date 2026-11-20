import type { EvalCase } from "../types";

export default {
  "id": "investment-signals-group",
  "title": "Added to a crypto 'signals' group promising weekly returns",
  "category": "investment_crypto",
  "source": "constructed",
  "label": "scam",
  "holdout": true,
  "screenshots": [
    {
      "template": "whatsapp",
      "contact": "Elite Crypto Signals UK",
      "messages": [
        {
          "from": "them",
          "text": "Welcome! You've been added to Elite Crypto Signals UK 🚀 Our members made 32% last week following our analyst's calls."
        },
        {
          "from": "them",
          "text": "Limited VIP places this month from £250. Message our analyst Daniel on WhatsApp to secure yours before Friday."
        }
      ]
    }
  ]
} satisfies EvalCase;

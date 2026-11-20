import type { EvalCase } from "../types";

export default {
  "id": "bank-spend-alert",
  "title": "Bank spending notification, no link",
  "category": "bank",
  "source": "constructed",
  "label": "genuine",
  "screenshots": [
    {
      "template": "sms",
      "sender": "Monzo",
      "messages": [
        "You spent £45.20 at TESCO STORES 2041. Balance: £612.18."
      ]
    }
  ]
} satisfies EvalCase;

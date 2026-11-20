import type { EvalCase } from "../types";

export default {
  "id": "bank-fraud-check-reply",
  "title": "Real bank fraud check asking you to reply Y or N",
  "category": "bank",
  "source": "constructed",
  "label": "genuine",
  "screenshots": [
    {
      "template": "sms",
      "sender": "HSBC UK",
      "messages": [
        "HSBC: Did you attempt a payment of £249.00 to CURRYS on 21/11? Reply Y if this was you or N if not. We'll never ask for your PIN, passwords or to move money."
      ]
    }
  ],
  "notes": "Alarming but genuine: banks really do send reply-Y/N checks. No link, no details asked for."
} satisfies EvalCase;

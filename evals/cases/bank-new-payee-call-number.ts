import type { EvalCase } from "../types";

export default {
  "id": "bank-new-payee-call-number",
  "title": "'Bank' text from a mobile number saying to call a fraud line",
  "category": "bank",
  "source": "constructed",
  "label": "suspicious",
  "screenshots": [
    {
      "template": "sms",
      "sender": "+44 7700 900512",
      "messages": [
        "Barclays: A new payee 'R SIMMONS' was added to your account at 14:02. If this was not you, call our fraud team immediately on 020 7946 0331."
      ]
    }
  ],
  "acceptableNextSteps": [
    "contact_through_official_channel",
    "dont_reply"
  ],
  "notes": "Banks do send payee alerts, but not from a mobile number with a number to call. Right advice: call the number on your card."
} satisfies EvalCase;

import type { EvalCase } from "../types";

export default {
  "id": "tax-hmrc-whatsapp-threat",
  "title": "'HMRC' WhatsApp threatening court over an unpaid balance",
  "category": "tax_government",
  "source": "gov_uk_ogl",
  "label": "scam",
  "holdout": true,
  "screenshots": [
    {
      "template": "whatsapp",
      "contact": "+44 7700 900233",
      "messages": [
        {
          "from": "them",
          "text": "HMRC NOTICE: Our records show an unpaid tax balance of £1,280.00. Failure to settle within 24 hours will result in a court summons and a visit from enforcement officers. Reply PAY to arrange payment today."
        }
      ]
    }
  ],
  "notes": "GOV.UK: HMRC doesn't contact people on WhatsApp apart from one-way channel alerts."
} satisfies EvalCase;

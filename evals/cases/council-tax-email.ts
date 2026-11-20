import type { EvalCase } from "../types";

export default {
  "id": "council-tax-email",
  "title": "Council tax bill notice pointing to the council's own site",
  "category": "tax_government",
  "source": "constructed",
  "label": "genuine",
  "holdout": true,
  "screenshots": [
    {
      "template": "email",
      "fromName": "Leeds City Council",
      "fromAddress": "counciltax@leeds.gov.uk",
      "subject": "Your council tax bill for 2027/28",
      "body": "Dear resident,\n\nYour council tax bill for 2027/28 is now available in your online account at leeds.gov.uk/counciltax.\n\nPayments will continue by Direct Debit as before. You don't need to do anything.\n\nLeeds City Council"
    }
  ],
  "lookups": {
    "domainAge": {
      "leeds.gov.uk": {
        "status": "ok",
        "registered": "1997-01-01",
        "ageDays": 10916
      }
    }
  }
} satisfies EvalCase;

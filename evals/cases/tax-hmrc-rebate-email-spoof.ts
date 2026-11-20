import type { EvalCase } from "../types";

export default {
  "id": "tax-hmrc-rebate-email-spoof",
  "title": "HMRC tax rebate email from a non-HMRC address",
  "category": "tax_government",
  "source": "gov_uk_ogl",
  "label": "scam",
  "screenshots": [
    {
      "template": "email",
      "fromName": "HM Revenue & Customs",
      "fromAddress": "refunds@hmrc-online-services[.]com",
      "subject": "Tax rebate notification",
      "body": "Dear Customer,\n\nAfter the last annual calculation of your fiscal activity we have determined that you are eligible to receive a tax rebate of £468.50.\n\nPlease submit the tax rebate request and allow us 3-5 business days to process it: hmrc-online-services[.]com/rebate\n\nA refund can be delayed for a variety of reasons, for example submitting invalid records or applying after the deadline.\n\nHM Revenue & Customs",
      "messy": true
    }
  ],
  "lookups": {
    "domainAge": {
      "hmrc-online-services.com": {
        "status": "ok",
        "registered": "2026-11-09",
        "ageDays": 12
      }
    },
    "urlReputation": {
      "hmrc-online-services.com": {
        "status": "flagged",
        "threats": [
          "SOCIAL_ENGINEERING"
        ]
      }
    }
  },
  "acceptableNextSteps": [
    "forward_to_7726_and_delete",
    "dont_reply",
    "dont_click_or_move_apps",
    "contact_through_official_channel"
  ],
  "notes": "Built from GOV.UK's guidance: HMRC only emails about rebates from addresses ending hmrc.gov.uk."
} satisfies EvalCase;

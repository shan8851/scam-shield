import type { EvalCase } from "../types";

export default {
  "id": "tax-customs-duty-parcel",
  "title": "Customs duty text for a parcel that doesn't exist",
  "category": "tax_government",
  "source": "gov_uk_ogl",
  "label": "scam",
  "text": "HMRC Customs: A parcel addressed to you is being held pending import duty of £4.20. Pay within 48 hours at https://uk-customs-duty[.]com/pay or it will be destroyed.",
  "lookups": {
    "domainAge": {
      "uk-customs-duty.com": {
        "status": "ok",
        "registered": "2026-11-12",
        "ageDays": 9
      }
    }
  },
  "wrongSignals": ["asks_for_personal_or_financial_details"],
  "acceptableNextSteps": [
    "forward_to_7726_and_delete",
    "dont_reply",
    "dont_click_or_move_apps",
    "contact_through_official_channel"
  ],
  "notes": "GOV.UK describes this customs duty parcel scam."
} satisfies EvalCase;

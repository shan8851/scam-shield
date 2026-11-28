import type { EvalCase } from "../types";

export default {
  id: "delivery-royal-mail-smish",
  title: "Royal Mail unpaid shipping fee text with an unregistered domain",
  category: "delivery",
  source: "constructed",
  label: "scam",
  text: "Royal Mail: Your parcel could not be delivered due to an unpaid shipping fee of £1.99. Pay within 24 hours at https://royalmail-redelivery-uk[.]com/pay or it will be returned to sender.",
  lookups: {
    domainAge: { "royalmail-redelivery-uk.com": { status: "not_found", registered: null, ageDays: null } },
    urlReputation: { "royalmail-redelivery-uk.com": { status: "unavailable", threats: [] } },
  },
  acceptableNextSteps: ["forward_to_7726_and_delete", "dont_reply", "dont_click_or_move_apps", "contact_through_official_channel"],
  wrongSignals: ["asks_for_personal_or_financial_details"],
} satisfies EvalCase;

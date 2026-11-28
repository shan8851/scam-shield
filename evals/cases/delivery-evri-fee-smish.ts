import type { EvalCase } from "../types";

export default {
  id: "delivery-evri-fee-smish",
  title: "Evri unpaid shipping fee text: pays through a link, asks for no details",
  category: "delivery",
  source: "constructed",
  label: "scam",
  text: "EVRI: We tried to deliver your parcel today but there was an unpaid shipping fee of £1.45. Your parcel will be returned to sender within 12 hours. Pay now: https://evri-redeliver-uk[.]top/pay",
  lookups: {
    domainAge: { "evri-redeliver-uk.top": { status: "ok", registered: "2026-11-23", ageDays: 5 } },
  },
  acceptableNextSteps: ["forward_to_7726_and_delete", "dont_reply", "dont_click_or_move_apps", "contact_through_official_channel"],
  wrongSignals: ["asks_for_personal_or_financial_details"],
  notes: "From the first live test (2026-11-28): the reply said \"It asks for personal or bank details\" when the message only asks for a fee through a link. asks_to_pay_through_link was added for it.",
} satisfies EvalCase;

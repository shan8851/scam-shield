import type { EvalCase } from "../types";

export default {
  id: "delivery-royal-mail-genuine",
  title: "Genuine Royal Mail delivery notice linking to royalmail.com",
  category: "delivery",
  source: "constructed",
  label: "genuine",
  holdout: true,
  screenshots: [
    {
      template: "sms",
      sender: "RoyalMail",
      messages: ["Royal Mail: Your parcel from Nordic Knitwear is due today between 11:15 and 13:15. Track it or choose a safe place at royalmail.com/track using reference QJ123456789GB."],
    },
  ],
  lookups: {
    domainAge: { "royalmail.com": { status: "ok", registered: "1995-09-12", ageDays: 11392 } },
    urlReputation: { "royalmail.com": { status: "clean", threats: [] } },
  },
  notes: "Twin of the smish: same organisation, same channel, nothing asked for.",
} satisfies EvalCase;

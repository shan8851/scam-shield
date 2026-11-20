import type { EvalCase } from "../types";

export default {
  id: "tax-hmrc-genuine-reminder",
  title: "Genuine HMRC Self Assessment reminder that points to GOV.UK",
  category: "tax_government",
  source: "constructed",
  label: "genuine",
  screenshots: [
    {
      template: "email",
      fromName: "HMRC",
      fromAddress: "noreply@confirmation.tax.service.gov.uk",
      subject: "Self Assessment: your tax return is due by 31 January",
      body: "Dear Sam Carter,\n\nYour Self Assessment tax return for the year ending 5 April 2026 is due by 31 January 2027.\n\nTo file your return, search GOV.UK for 'Self Assessment' and sign in to your HMRC online account.\n\nWe will never ask you for your bank details or passwords by email.\n\nHM Revenue and Customs",
    },
  ],
  lookups: { domainAge: { "gov.uk": { status: "ok", registered: "1996-08-01", ageDays: 11070 } } },
  notes: "Twin of the refund smish: tells you to go to GOV.UK yourself, asks for nothing.",
} satisfies EvalCase;

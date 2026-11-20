import type { EvalCase } from "../types";

export default {
  "id": "tax-social-dm-refund",
  "title": "Tax refund offered in a social media DM, asking for NI number and bank details",
  "category": "tax_government",
  "source": "gov_uk_ogl",
  "label": "scam",
  "text": "Hi, this is HMRC Support. Our system shows you're owed a tax refund of £214. To process it, reply here with your full name, National Insurance number, date of birth and bank details.",
  "notes": "GOV.UK: HMRC never uses social media to offer rebates or ask for personal details."
} satisfies EvalCase;

import type { EvalCase } from "../types";

export default {
  "id": "invoice-redirect-multi",
  "title": "Supplier email thread where the bank details 'change' in the second screenshot, from a lookalike domain",
  "category": "phishing_email",
  "source": "constructed",
  "label": "scam",
  "gate": "multi_image",
  "screenshots": [
    {
      "template": "email",
      "fromName": "Brightline Builders Accounts",
      "fromAddress": "accounts@brightlinebuilders.co.uk",
      "subject": "Invoice 2291 – kitchen extension, stage 2",
      "body": "Hi Sam,\n\nPlease find attached invoice 2291 for stage 2 of the kitchen extension, £6,800, due on 28 November as agreed.\n\nAny questions just let me know.\n\nThanks,\nKaren\nBrightline Builders"
    },
    {
      "template": "email",
      "fromName": "Brightline Builders Accounts",
      "fromAddress": "accounts@brightlinebuiders.co.uk",
      "subject": "RE: Invoice 2291 – kitchen extension, stage 2",
      "body": "Hi Sam,\n\nQuick update: our bank details have changed as we've moved banks. Please use the new account below for invoice 2291 and all future payments, and pay today if you can so we don't hold up the next stage.\n\nSort code 11-22-33, account 87654321, Brightline Builders Ltd\n\nThanks,\nKaren"
    }
  ],
  "lookups": {
    "domainAge": {
      "brightlinebuilders.co.uk": {
        "status": "ok",
        "registered": "2014-03-02",
        "ageDays": 4646
      },
      "brightlinebuiders.co.uk": {
        "status": "ok",
        "registered": "2026-11-17",
        "ageDays": 4
      }
    }
  },
  "notes": "Invoice redirection: the second email comes from a domain one letter off. Only comparing both screenshots shows it."
} satisfies EvalCase;

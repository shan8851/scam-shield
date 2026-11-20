import type { EvalCase } from "../types";

export default {
  "id": "energy-bill-email",
  "title": "Energy bill ready email from the supplier's own domain",
  "category": "everyday_genuine",
  "source": "constructed",
  "label": "genuine",
  "screenshots": [
    {
      "template": "email",
      "fromName": "Octopus Energy",
      "fromAddress": "hello@octopus.energy",
      "subject": "Your latest bill is ready",
      "body": "Hi Sam,\n\nYour bill for 1 Oct to 31 Oct is ready: £84.17, which will be collected by Direct Debit on 8 November.\n\nYou can see the breakdown in your account at octopus.energy/dashboard.\n\nThe Octopus Energy team",
      "messy": true,
      "hideAddress": true
    }
  ],
  "lookups": {
    "domainAge": {
      "octopus.energy": {
        "status": "ok",
        "registered": "2015-10-05",
        "ageDays": 4064
      }
    },
    "urlReputation": {
      "octopus.energy": {
        "status": "clean",
        "threats": []
      }
    }
  }
} satisfies EvalCase;

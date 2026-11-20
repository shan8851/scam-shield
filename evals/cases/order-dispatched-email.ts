import type { EvalCase } from "../types";

export default {
  "id": "order-dispatched-email",
  "title": "Order dispatched email from a retailer's own domain",
  "category": "everyday_genuine",
  "source": "constructed",
  "label": "genuine",
  "screenshots": [
    {
      "template": "email",
      "fromName": "John Lewis",
      "fromAddress": "orders@johnlewis.com",
      "subject": "Your order is on its way",
      "body": "Hello Sam,\n\nGood news: your order 41-882301 has been dispatched and should arrive on Tuesday.\n\nYou can track it any time in your account at johnlewis.com/account.\n\nThank you for shopping with us.",
      "messy": true
    }
  ],
  "lookups": {
    "domainAge": {
      "johnlewis.com": {
        "status": "ok",
        "registered": "1996-03-15",
        "ageDays": 11208
      }
    },
    "urlReputation": {
      "johnlewis.com": {
        "status": "clean",
        "threats": []
      }
    }
  }
} satisfies EvalCase;

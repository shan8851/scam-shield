import type { EvalCase } from "../types";

export default {
  "id": "delivery-dpd-genuine",
  "title": "DPD delivery window text with driver name and dpd.co.uk link",
  "category": "delivery",
  "source": "constructed",
  "label": "genuine",
  "holdout": true,
  "screenshots": [
    {
      "template": "sms",
      "sender": "DPD",
      "messages": [
        "DPD: Your parcel from JD Williams will be delivered today 13:12-14:12 by Kamil. Track or change delivery: dpd.co.uk/track"
      ]
    }
  ],
  "lookups": {
    "domainAge": {
      "dpd.co.uk": {
        "status": "ok",
        "registered": "1997-06-11",
        "ageDays": 10755
      }
    },
    "urlReputation": {
      "dpd.co.uk": {
        "status": "clean",
        "threats": []
      }
    }
  }
} satisfies EvalCase;

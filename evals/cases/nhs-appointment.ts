import type { EvalCase } from "../types";

export default {
  "id": "nhs-appointment",
  "title": "NHS appointment reminder linking to nhs.uk",
  "category": "everyday_genuine",
  "source": "constructed",
  "label": "genuine",
  "text": "NHS: Your appointment at St Mary's Outpatients is on Wed 3 Dec at 14:20. To cancel or rebook, use the NHS App or visit www.nhs.uk/nhs-app.",
  "lookups": {
    "domainAge": {
      "nhs.uk": {
        "status": "ok",
        "registered": "1999-03-24",
        "ageDays": 10102
      }
    },
    "urlReputation": {
      "nhs.uk": {
        "status": "clean",
        "threats": []
      }
    }
  }
} satisfies EvalCase;

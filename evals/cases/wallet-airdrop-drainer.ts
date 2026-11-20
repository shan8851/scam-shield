import type { EvalCase } from "../types";

export default {
  "id": "wallet-airdrop-drainer",
  "title": "Airdrop claim DM asking you to connect your wallet",
  "category": "investment_crypto",
  "source": "constructed",
  "label": "scam",
  "holdout": true,
  "text": "🎉 Congrats! Your wallet qualifies for the $LAYER airdrop (2,400 tokens). Claim within 24h at claim-layer-airdrop[.]xyz — connect your wallet to verify eligibility.",
  "lookups": {
    "domainAge": {
      "claim-layer-airdrop.xyz": {
        "status": "ok",
        "registered": "2026-11-19",
        "ageDays": 2
      }
    },
    "urlReputation": {
      "claim-layer-airdrop.xyz": {
        "status": "flagged",
        "threats": [
          "SOCIAL_ENGINEERING"
        ]
      }
    }
  }
} satisfies EvalCase;

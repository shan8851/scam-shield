import type { EvalCase } from "../types";

export default {
  "id": "account-takeover-code",
  "title": "A contact asks you to forward a code 'sent to you by mistake'",
  "category": "family_impersonation",
  "source": "constructed",
  "label": "scam",
  "screenshots": [
    {
      "template": "whatsapp",
      "contact": "Jen (book club)",
      "messages": [
        {
          "from": "them",
          "text": "Hiya! So sorry, I've accidentally sent my 6-digit code to your number instead of mine 🙈 can you forward it to me? It's a bit urgent x"
        }
      ]
    }
  ],
  "notes": "WhatsApp account takeover from an already-compromised friend: the name is genuine, the ask isn't."
} satisfies EvalCase;

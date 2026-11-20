import type { EvalCase } from "../types";

export default {
  "id": "wrong-number-opener",
  "title": "'Wrong number' opener that could start a long con",
  "category": "investment_crypto",
  "source": "constructed",
  "label": "suspicious",
  "text": "Hi Lisa, is this still your number? Are we still on for dinner Saturday at 7? 😊",
  "acceptableNextSteps": [
    "dont_reply",
    "ask_for_details_in_same_app",
    "dont_click_or_move_apps"
  ],
  "notes": "Could be a genuine wrong number; also the classic opener for romance and investment scams. Nothing to do but not engage."
} satisfies EvalCase;

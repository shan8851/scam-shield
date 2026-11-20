import type { EvalCase } from "../types";

export default {
  "id": "friend-squash-booking",
  "title": "A friend confirming a squash game",
  "category": "everyday_genuine",
  "source": "constructed",
  "label": "genuine",
  "screenshots": [
    {
      "template": "whatsapp",
      "contact": "Mark (squash)",
      "messages": [
        {
          "from": "them",
          "text": "Still ok for Thursday 7pm? I've booked court 3"
        },
        {
          "from": "me",
          "text": "Yep see you there"
        },
        {
          "from": "them",
          "text": "Bring the good balls this time 😂"
        }
      ]
    }
  ]
} satisfies EvalCase;

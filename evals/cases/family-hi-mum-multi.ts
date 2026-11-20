import type { EvalCase } from "../types";

export default {
  id: "family-hi-mum-multi",
  title: "'Hi Mum' new-number scam whose ask only arrives in the third screenshot",
  category: "family_impersonation",
  source: "constructed",
  label: "scam",
  gate: "multi_image",
  screenshots: [
    {
      template: "whatsapp",
      contact: "+44 7700 900861",
      messages: [
        { from: "them", text: "Hi Mum it's me, I dropped my phone down the loo 🙈 this is my new number, can you save it" },
        { from: "me", text: "Oh no! Which one of you is this?" },
      ],
    },
    {
      template: "whatsapp",
      contact: "+44 7700 900861",
      messages: [
        { from: "them", text: "Your favourite of course 😂 I'm all ok just annoying, the old one's completely dead" },
        { from: "them", text: "Are you about today? Need a quick favour" },
        { from: "me", text: "Yes love what is it" },
      ],
    },
    {
      template: "whatsapp",
      contact: "+44 7700 900861",
      messages: [
        { from: "them", text: "I've got a bill that has to be paid today and my banking app won't let me log in on the new phone till tomorrow" },
        { from: "them", text: "Could you pay it for me and I'll send it back tomorrow? It's £1,450. I'll send you the account details. Please don't call, the mic on this phone is broken" },
      ],
    },
  ],
  notes: "No single screenshot carries the whole scam; the ask and the refusal to call come last.",
} satisfies EvalCase;

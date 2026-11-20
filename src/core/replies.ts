/**
 * Fixed replies the gate can send. The model never writes user-facing text;
 * these strings are the whole vocabulary at this stage. Final copy lands in
 * the replies PR (build step 3).
 */
export const replies = {
  inviteOnly:
    "This number is invite-only. If someone shared it with you, ask them to add you.",
  checking: "Checking…",
  coolOff:
    "You've sent a lot of checks in a short time. Please wait a little and try again.",
  busyToday:
    "The checker has reached its limit for today. Please try again tomorrow.",
  unsupportedVoice:
    "I can't check voice notes. Send a screenshot or type what they said.",
  unsupportedDocument:
    "I can't check documents yet. Send a screenshot of the message instead.",
  unsupportedOther:
    "I can't check this type of message. Send a screenshot or the text instead.",
} as const;

export type ReplyKey = keyof typeof replies;

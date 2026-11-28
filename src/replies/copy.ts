import type { NextStep, Organisation, Signal, Verdict } from "../agent/vocabulary.js";

/**
 * Every word the bot can say. This is the file to edit for tone and wording;
 * `render.ts` only assembles these pieces. The types make it impossible to
 * add a signal, next step or organisation without writing its copy.
 *
 * Nothing from the forwarded message ever appears in a reply: not its text,
 * not its links, not even a domain name. Facts from lookups are described
 * ("the link's website was set up 3 days ago"), never echoed, so the bot
 * can't hand anyone a tappable scam link.
 *
 * Formatting is Telegram's Markdown: *bold*, _italic_, plain line breaks.
 */

// --- Fixed replies the gate and the loop send ---------------------------

export const fixedReplies = {
  inviteOnly:
    "This bot is invite-only. If someone shared it with you, ask them to add you.",
  welcome:
    "Hi! Forward me anything that looks suspicious: a text, an email, a screenshot or a link. I'll tell you whether it looks like a scam, why, and what to do. I'll never ask for your details.",
  checking: "Checking…",
  checkingPart:
    "Checking… That was a lot in one go, so I'm only looking at the first part. Send the rest separately.",
  coolOff:
    "You've sent a lot of checks in a short time. Please wait a little and try again.",
  busyToday:
    "The checker has reached its limit for today. Please try again tomorrow.",
  paused:
    "The checker is paused for now. If you're worried about a message, don't click anything and check with the organisation directly.",
  unsupportedVoice:
    "I can't check voice notes. Send a screenshot or type what they said.",
  unsupportedDocument:
    "I can't check documents yet. Send a screenshot of the message instead.",
  unsupportedOther:
    "I can't check this type of message. Send a screenshot or the text instead.",
  checkFailed:
    "I couldn't check this one properly. Treat it with care: don't click links or send money until you're sure.",
} as const;

export type ReplyKey = keyof typeof fixedReplies;

// --- Messages to the admin ----------------------------------------------
// Sent as plain text, because they include names and usernames people chose.

const who = (p: { displayName: string | null; username: string | null }) =>
  [p.displayName ?? "Someone", p.username ? `(@${p.username})` : ""].filter(Boolean).join(" ");

export const adminText = {
  newRequest: (p: { displayName: string | null; username: string | null }) => `New request: ${who(p)} wants to use the bot.`,
  approved: (p: { displayName: string | null; username: string | null }) => `✅ Approved ${who(p)}.`,
  denied: (p: { displayName: string | null; username: string | null }) => `❌ Denied ${who(p)}.`,
  alreadyDecided: "That request has already been handled.",
  noPending: "No one is waiting.",
  pendingHeader: (n: number) => `${n} waiting:`,
  paused: "⏸ Paused. Nothing will be checked until you send /resume.",
  resumed: "▶️ Resumed. Checks are back on.",
  status: (s: { paused: boolean; checks24h: number; failed24h: number; tokens24h: number; pending: number; allowed: number }) =>
    [
      s.paused ? "⏸ Paused" : "▶️ Running",
      `Last 24 hours: ${s.checks24h} checks, ${s.failed24h} failed, ${s.tokens24h.toLocaleString("en-GB")} tokens`,
      `People: ${s.allowed} allowed, ${s.pending} waiting`,
    ].join("\n"),
  alert: {
    budget_exhausted: "⚠️ The daily budget has run out. New checks are turned away until it frees up.",
    failures_in_a_row: "⚠️ The last 3 checks all failed. Something may be broken: check the Vercel logs.",
    stranger_burst: "⚠️ Several unknown people have messaged the bot in the last hour. Use /pending to see them, or /pause if it looks like abuse.",
  },
  approveButton: "✅ Approve",
  denyButton: "❌ Deny",
};

/** What an approved person is told, so they know they can start. */
export const approvedWelcome =
  "You're in. Forward me anything that looks suspicious: a text, an email, a screenshot or a link.";

// --- Verdict replies ------------------------------------------------------

export const verdictHeader: Record<Verdict, string> = {
  likely_scam: "⚠️ *Likely a scam*",
  suspicious: "🤔 *Suspicious*",
  looks_genuine: "👍 *Looks genuine: no scam signs found*",
};

/**
 * Said instead of signal lines when the verdict is "looks genuine": one
 * version when links were checked, one when there were none to check.
 */
export const genuineReason = {
  withLinks: "It doesn't ask for money, codes or personal details, and nothing about its links looks wrong.",
  noLinks: "It doesn't ask for money, codes or personal details, and nothing in it looks off.",
};

/** One plain sentence per signal, each saying what to do where it can. */
export const signalLine: Record<Signal, string> = {
  asks_for_codes_or_passwords: "It asks for a code or password. Never share these with anyone.",
  asks_to_download_or_run_something:
    "It asks you to install or run something. Never install anything or run code someone sends you, least of all on a work computer.",
  asks_to_sign_in_or_connect_wallet:
    "It asks you to sign in or connect a wallet through its link. Go to the real site yourself instead.",
  unusual_payment_method:
    "It asks for payment in a way real organisations don't use, like gift cards, crypto or a \"safe account\".",
  asks_for_personal_or_financial_details: "It asks for personal or bank details. Don't send them.",
  link_does_not_match_sender: "The link doesn't go where it claims to. Don't click it.",
  impersonates_authority: "It claims to be {org}, but the details don't match.",
  moves_to_another_app: "It wants to move you to another app, away from where it started.",
  threatens_consequences: "It threatens you with trouble if you don't act. Real organisations don't do that by message.",
  too_good_to_be_true: "The offer is too good to be true.",
  shortened_link: "It uses a shortened link, so where it leads can't be checked.",
  urgency: "It's rushing you. Scammers want you to act before you think.",
};

/** Order signal lines are shown in: the most dangerous asks first. */
export const signalPriority: readonly Signal[] = [
  "asks_for_codes_or_passwords",
  "asks_to_download_or_run_something",
  "asks_to_sign_in_or_connect_wallet",
  "unusual_payment_method",
  "asks_for_personal_or_financial_details",
  "link_does_not_match_sender",
  "impersonates_authority",
  "moves_to_another_app",
  "threatens_consequences",
  "too_good_to_be_true",
  "urgency",
  "shortened_link",
];

/** At most this many signal lines, so a reply stays readable on a phone. */
export const maxSignalLines = 3;

/** Facts from the lookups, shown only when they count against a message. */
export const lookupFact = {
  youngDomain: (days: number) =>
    days === 0
      ? "The link's website was set up today."
      : days === 1
        ? "The link's website was set up yesterday."
        : `The link's website was set up ${days} days ago.`,
  domainNotFound: "The link points to a website that isn't registered.",
  flagged: "Google lists the link as dangerous.",
};

/** How each organisation is named in a sentence. */
export const organisationName: Record<Organisation, string> = {
  none: "someone",
  hmrc: "HMRC",
  royal_mail: "Royal Mail",
  dvla: "the DVLA",
  bank: "your bank",
  delivery_company: "a delivery company",
  employer_or_recruiter: "an employer or recruiter",
  government_other: "a government body",
  tech_company: "a tech company",
  crypto_company: "a crypto company",
  family_or_friend: "someone you know",
  other: "someone it isn't",
};

/** The safe way to check with each organisation directly. */
export const officialChannel: Record<Organisation, string> = {
  none: "Check through their own website or app, not through anything in the message.",
  hmrc: "Check with HMRC through gov.uk, not through anything in the message.",
  royal_mail: "Check on royalmail.com or the Royal Mail app, not through anything in the message.",
  dvla: "Check with the DVLA through gov.uk, not through anything in the message.",
  bank: "Call your bank on the number on the back of your card, not any number in the message.",
  delivery_company: "Check in the courier's own app or website, not through anything in the message.",
  employer_or_recruiter: "Check the role on the company's own careers page, not through anything in the message.",
  government_other: "Check through gov.uk, not through anything in the message.",
  tech_company: "Check in the company's own app or website, typed in yourself.",
  crypto_company: "Check in the company's own app or website, typed in yourself.",
  family_or_friend: "Call them on the number you already have before doing anything.",
  other: "Check through their own website or app, not through anything in the message.",
};

/** The next-step line. `contact_through_official_channel` uses the table above. */
export const nextStepLine: Record<Exclude<NextStep, "contact_through_official_channel" | "none">, string> = {
  ask_for_details_in_same_app:
    "Asking for more details in the same app is low risk. Don't click links or move to another app until you're sure.",
  dont_click_or_move_apps: "Don't click any links or move to another app until you're sure.",
  forward_to_7726_and_delete: "Forward it to 7726 (it's free), then delete it.",
  dont_reply: "Don't reply: that only tells them your number is live.",
};

/** HMRC has its own reporting number, used instead of 7726. */
export const hmrcReportLine = "Forward it to 60599 (HMRC's scam line, free), then delete it.";

export const whatToDoLabel = "*What to do:*";

export const footer = "_A second opinion, not a guarantee. Trust your judgement._";

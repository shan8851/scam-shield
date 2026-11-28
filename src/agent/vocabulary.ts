/**
 * The fixed vocabulary the model answers in. `submit_verdict` accepts only
 * these values, and the reply templates are keyed on them, so the model
 * never writes text a user sees.
 */

export const verdicts = ["likely_scam", "suspicious", "looks_genuine"] as const;
export type Verdict = (typeof verdicts)[number];

/** Scam tactics, not scam categories: categories change, tactics don't. */
export const signals = [
  "urgency",
  "threatens_consequences",
  "impersonates_authority",
  "unusual_payment_method",
  "asks_for_codes_or_passwords",
  "asks_for_personal_or_financial_details",
  "asks_to_pay_through_link",
  "link_does_not_match_sender",
  "shortened_link",
  "too_good_to_be_true",
  "moves_to_another_app",
  "asks_to_download_or_run_something",
  "asks_to_sign_in_or_connect_wallet",
] as const;
export type Signal = (typeof signals)[number];

export const organisations = [
  "none",
  "hmrc",
  "royal_mail",
  "dvla",
  "bank",
  "delivery_company",
  "employer_or_recruiter",
  "government_other",
  "tech_company",
  "crypto_company",
  "family_or_friend",
  "other",
] as const;
export type Organisation = (typeof organisations)[number];

export const nextSteps = [
  "ask_for_details_in_same_app",
  "dont_click_or_move_apps",
  "contact_through_official_channel",
  "forward_to_7726_and_delete",
  "dont_reply",
  "none",
] as const;
export type NextStep = (typeof nextSteps)[number];

/** What the model submits through `submit_verdict`. */
export interface VerdictSubmission {
  verdict: Verdict;
  signals: Signal[];
  impersonating: Organisation;
  next_step: NextStep;
}

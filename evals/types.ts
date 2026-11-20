import type { DomainAgeResult, UrlReputationResult } from "../src/agent/lookups";
import type { NextStep } from "../src/agent/vocabulary";

/**
 * One eval case. Cases are public, so they follow the repo's rules: invented
 * names, Ofcom drama numbers, and scam links defanged in the file (the runner
 * refangs them before the model sees them, so defanging can't be a tell).
 */
export interface EvalCase {
  id: string;
  title: string;
  category: Category;
  source: "real_redacted" | "gov_uk_ogl" | "paraphrased" | "constructed";
  /** What the message really is. Unclear cases are labelled suspicious. */
  label: "scam" | "suspicious" | "genuine";
  /** Held back while tuning: scored, but never shown case by case. */
  holdout?: boolean;
  /** Cases where any miss fails the whole run. */
  gate?: "injection" | "multi_image";
  /** The forwarded text, if any. */
  text?: string;
  /** Screenshots, rendered from templates by `pnpm eval:screens`. */
  screenshots?: Screenshot[];
  /** Recorded lookup answers; anything not listed is "unavailable". */
  lookups?: {
    domainAge?: Record<string, Omit<DomainAgeResult, "domain">>;
    urlReputation?: Record<string, Omit<UrlReputationResult, "domain">>;
  };
  /** If set, other next steps add a small cost. */
  acceptableNextSteps?: NextStep[];
  notes?: string;
}

export type Category =
  | "job"
  | "delivery"
  | "tax_government"
  | "bank"
  | "phishing_email"
  | "threat"
  | "family_impersonation"
  | "investment_crypto"
  | "everyday_genuine"
  | "injection";

export type Screenshot =
  | { template: "sms"; sender: string; messages: string[] }
  | { template: "whatsapp"; contact: string; messages: { from: "them" | "me"; text: string }[] }
  | { template: "email"; fromName: string; fromAddress: string; subject: string; body: string; verified?: boolean }
  | { template: "linkedin"; name: string; headline: string; messages: { from: "them" | "me"; name: string; text: string }[] };

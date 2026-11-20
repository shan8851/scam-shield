import type Anthropic from "@anthropic-ai/sdk";
import { nextSteps, organisations, signals, verdicts } from "./vocabulary";

/** The three tools the model can call. `strict` keeps inputs to the schema. */
export const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "check_domain_age",
    description:
      "When a domain was registered, from the domain registry. Never visits the site. Use for links and sender domains that appear in the message.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { domain: { type: "string", description: "A domain from the message, e.g. royalmail-fees.com" } },
      required: ["domain"],
      additionalProperties: false,
    },
  },
  {
    name: "check_url_reputation",
    description:
      "Whether Google Safe Browsing knows the URL as phishing or malware. Never visits the link. Use for links that appear in the message.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { url: { type: "string", description: "A link from the message, exactly as it appears" } },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "submit_verdict",
    description: "Submit the final verdict. Call exactly once, at the end.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: [...verdicts] },
        signals: { type: "array", items: { type: "string", enum: [...signals] } },
        impersonating: { type: "string", enum: [...organisations] },
        next_step: { type: "string", enum: [...nextSteps] },
      },
      required: ["verdict", "signals", "impersonating", "next_step"],
      additionalProperties: false,
    },
  },
];

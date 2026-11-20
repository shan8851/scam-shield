import type { EvalCase } from "../types";
import clean from "./job-genuine-wallet-recruiter";

const shot = clean.screenshots[0]!;

export default {
  id: "job-genuine-wallet-recruiter-messy",
  title: "The same genuine recruiter email as a real mail app shows it: no address in the header",
  category: "job",
  source: "real_redacted",
  label: "genuine",
  screenshots: [
    {
      ...shot,
      messy: true,
      hideAddress: true,
      linkText: "calendly link",
      body: `${shot.body}\nrosa@phantom.app`,
    },
  ],
  lookups: clean.lookups,
  notes: "Closer to the real screenshot: the sender's domain appears only in the signature. Before the eval this presentation came back suspicious about 1 run in 3.",
} satisfies EvalCase;

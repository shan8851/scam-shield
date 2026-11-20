import type { EvalCase } from "../types";

export default {
  "id": "job-genuine-plain-recruiter",
  "title": "Plain recruiter message pointing to the company's own careers page",
  "category": "job",
  "source": "constructed",
  "label": "genuine",
  "screenshots": [
    {
      "template": "linkedin",
      "name": "Hannah Price",
      "headline": "Senior Technical Recruiter at Monzo",
      "messages": [
        {
          "from": "them",
          "name": "Hannah Price",
          "text": "Hi Sam, I'm a recruiter at Monzo. We're hiring senior backend engineers in London; the role details are on monzo.com/careers. Happy to have a chat if it's of interest, no worries if not."
        }
      ]
    }
  ],
  "lookups": {
    "domainAge": {
      "monzo.com": {
        "status": "ok",
        "registered": "2015-02-10",
        "ageDays": 4302
      }
    },
    "urlReputation": {
      "monzo.com": {
        "status": "clean",
        "threats": []
      }
    }
  },
  "notes": "Unsolicited, but it points to the company's own site and asks for nothing. Guards against 'every recruiter is suspicious'."
} satisfies EvalCase;

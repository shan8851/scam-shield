import { describe, expect, it } from "vitest";
import type { LookupResult } from "../src/agent/hooks";
import type { CheckOutcome } from "../src/agent/loop";
import { nextSteps, organisations, signals, verdicts, type VerdictSubmission } from "../src/agent/vocabulary";
import { fixedReplies, footer } from "../src/replies/copy";
import { renderReply, renderVerdict } from "../src/replies/render";

const young: LookupResult = { domain: "royalmail-fees.com", status: "ok", registered: "2026-11-17", ageDays: 3 };
const flagged: LookupResult = { domain: "royalmail-fees.com", status: "flagged", threats: ["SOCIAL_ENGINEERING"] };

describe("rendering a verdict", () => {
  it("renders a scam: header, reasons, what to do, footer", () => {
    const v: VerdictSubmission = {
      verdict: "likely_scam",
      signals: ["urgency", "unusual_payment_method"],
      impersonating: "royal_mail",
      next_step: "forward_to_7726_and_delete",
    };
    expect(renderVerdict(v, [young])).toBe(
      [
        "⚠️ *Likely a scam*",
        [
          "• It asks for payment in a way real organisations don't use, like gift cards, crypto or a \"safe account\".",
          "• It's rushing you. Scammers want you to act before you think.",
          "• The link's website was set up 3 days ago.",
        ].join("\n"),
        "*What to do:* Forward it to 7726 (it's free), then delete it.",
        footer,
      ].join("\n\n"),
    );
  });

  it("never echoes a domain, even one the lookups returned", () => {
    const v: VerdictSubmission = { verdict: "likely_scam", signals: ["link_does_not_match_sender"], impersonating: "royal_mail", next_step: "dont_reply" };
    const reply = renderVerdict(v, [young, flagged]);
    expect(reply).not.toContain("royalmail-fees");
    expect(reply).toContain("Google lists the link as dangerous.");
  });

  it("shows at most three signals, most dangerous first", () => {
    const v: VerdictSubmission = { verdict: "likely_scam", signals: [...signals], impersonating: "bank", next_step: "dont_reply" };
    const bullets = renderVerdict(v, []).split("\n").filter((l) => l.startsWith("• "));
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toContain("code or password");
  });

  it("names the organisation being impersonated", () => {
    const v: VerdictSubmission = { verdict: "suspicious", signals: ["impersonates_authority"], impersonating: "hmrc", next_step: "contact_through_official_channel" };
    const reply = renderVerdict(v, []);
    expect(reply).toContain("It claims to be HMRC, but the details don't match.");
    expect(reply).toContain("Check with HMRC through gov.uk");
  });

  it("uses HMRC's own reporting number for HMRC scams", () => {
    const v: VerdictSubmission = { verdict: "likely_scam", signals: ["urgency"], impersonating: "hmrc", next_step: "forward_to_7726_and_delete" };
    expect(renderVerdict(v, [])).toContain("60599");
  });

  it("says plainly when a message looks fine, with no next step to take", () => {
    const v: VerdictSubmission = { verdict: "looks_genuine", signals: [], impersonating: "none", next_step: "none" };
    expect(renderVerdict(v, [])).toBe(
      ["👍 *Looks genuine: no scam signs found*", "It doesn't ask for money, codes or personal details, and nothing about its links looks wrong.", footer].join("\n\n"),
    );
  });

  it("never mentions a clean lookup", () => {
    const v: VerdictSubmission = { verdict: "suspicious", signals: ["too_good_to_be_true"], impersonating: "employer_or_recruiter", next_step: "ask_for_details_in_same_app" };
    const clean: LookupResult = { domain: "navaday.ai", status: "clean", threats: [] };
    const old: LookupResult = { domain: "navaday.ai", status: "ok", registered: "2020-01-01", ageDays: 2000 };
    expect(renderVerdict(v, [clean, old]).split("\n").filter((l) => l.startsWith("• "))).toHaveLength(1);
  });

  it("renders every combination without a gap or a leftover placeholder", () => {
    for (const verdict of verdicts)
      for (const next_step of nextSteps)
        for (const impersonating of organisations) {
          const reply = renderVerdict({ verdict, signals: verdict === "looks_genuine" ? [] : [...signals], impersonating, next_step }, []);
          expect(reply).not.toMatch(/\{|\}|undefined|null/);
          expect(reply.endsWith(footer)).toBe(true);
        }
  });
});

describe("rendering a check outcome", () => {
  it("gives the honest fallback for a failed check", () => {
    const failed: CheckOutcome = { status: "failed", reason: "model refused", trace: [], tokens: 0, turns: 1 };
    expect(renderReply(failed)).toBe(fixedReplies.checkFailed);
  });

  it("takes lookup facts from the trace", () => {
    const done: CheckOutcome = {
      status: "done",
      verdict: { verdict: "likely_scam", signals: ["urgency"], impersonating: "royal_mail", next_step: "dont_reply" },
      trace: [{ kind: "tool", name: "check_domain_age", target: "royalmail-fees.com", result: young }],
      tokens: 0,
      turns: 2,
    };
    expect(renderReply(done)).toContain("set up 3 days ago");
  });
});

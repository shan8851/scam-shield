import { describe, expect, it } from "vitest";
import { fakeLookups, liveLookups, parseRdap, parseSafeBrowsing } from "../src/agent/lookups";

const now = new Date("2026-11-20T12:00:00Z");

describe("lookups", () => {
  it("reads the registration date and age from RDAP", () => {
    const body = { events: [{ eventAction: "last changed", eventDate: "2026-11-01T00:00:00Z" }, { eventAction: "registration", eventDate: "2026-11-17T08:00:00Z" }] };
    expect(parseRdap("fees.example", body, now)).toEqual({ domain: "fees.example", status: "ok", registered: "2026-11-17", ageDays: 3 });
  });

  it("treats RDAP without a registration date as unavailable", () => {
    expect(parseRdap("x.example", { events: [] }, now).status).toBe("unavailable");
  });

  it("reads Safe Browsing matches as flagged, and no matches as clean", () => {
    expect(parseSafeBrowsing("bad.example", { matches: [{ threatType: "SOCIAL_ENGINEERING" }, { threatType: "SOCIAL_ENGINEERING" }] }))
      .toEqual({ domain: "bad.example", status: "flagged", threats: ["SOCIAL_ENGINEERING"] });
    expect(parseSafeBrowsing("ok.example", {})).toEqual({ domain: "ok.example", status: "clean", threats: [] });
  });

  it("reports Safe Browsing as unavailable without a key, and never calls out", async () => {
    let called = false;
    const lookups = liveLookups({ fetch: (async () => { called = true; return new Response("{}"); }) as typeof fetch });
    expect((await lookups.urlReputation("https://bad.example/x")).status).toBe("unavailable");
    expect(called).toBe(false);
  });

  it("maps an RDAP 404 to not_found and a network failure to unavailable", async () => {
    const notFound = liveLookups({ fetch: (async () => new Response("", { status: 404 })) as typeof fetch });
    expect((await notFound.domainAge("nope.example", now)).status).toBe("not_found");
    const broken = liveLookups({ fetch: (async () => { throw new Error("offline"); }) as typeof fetch });
    expect((await broken.domainAge("x.example", now)).status).toBe("unavailable");
  });

  it("serves recorded answers from the fake", async () => {
    const lookups = fakeLookups({ domainAge: { "fees.example": { status: "ok", registered: "2026-11-17", ageDays: 3 } } });
    expect((await lookups.domainAge("fees.example", now)).ageDays).toBe(3);
    expect((await lookups.domainAge("other.example", now)).status).toBe("unavailable");
  });
});

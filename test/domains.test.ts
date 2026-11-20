import { describe, expect, it } from "vitest";
import { domainsInText, publicDomain, refang } from "../src/agent/domains";

describe("domains", () => {
  it("refangs defanged links", () => {
    expect(refang("hxxps://parcel-fee[.]example[.]com")).toBe("https://parcel-fee.example.com");
  });

  it("reduces a URL to its registrable domain", () => {
    expect(publicDomain("https://royalmail.com.parcel-fee.xyz/pay?x=1")).toBe("parcel-fee.xyz");
    expect(publicDomain("www.gov.uk")).toBe("www.gov.uk");
    expect(publicDomain("https://calendly.com/someone/intro")).toBe("calendly.com");
  });

  it("refuses things that aren't public internet domains", () => {
    for (const bad of ["127.0.0.1", "http://localhost:3000", "intranet", "10.0.0.5/admin", "printer.local"]) {
      expect(publicDomain(bad)).toBeNull();
    }
  });

  it("finds every domain in a message, once each, defanged or not", () => {
    const text = "Pay now at hxxps://royalmail-fees[.]com/pay or https://royalmail-fees.com, see royalmail.com";
    expect(domainsInText(text)).toEqual(["royalmail-fees.com", "royalmail.com"]);
  });

  it("finds nothing in plain prose", () => {
    expect(domainsInText("Hi mum, my phone broke. Can you send £200?")).toEqual([]);
  });
});

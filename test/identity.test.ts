import { describe, expect, it } from "vitest";
import { hashNumber, last4, normaliseNumber, senderHashSecret } from "../src/core/identity";
import { secret } from "./helpers";

describe("identity", () => {
  it("normalises the ways a UK number gets written", () => {
    for (const raw of ["07700 900001", "+44 7700 900001", "00447700900001", "447700900001"]) {
      expect(normaliseNumber(raw)).toBe("447700900001");
    }
  });

  it("rejects things that aren't phone numbers", () => {
    expect(() => normaliseNumber("hello")).toThrow();
    expect(() => normaliseNumber("123")).toThrow();
  });

  it("hashes the same number the same way, whatever the format", () => {
    expect(hashNumber("07700900001", secret)).toBe(hashNumber("+447700900001", secret));
  });

  it("gives a different hash under a different secret", () => {
    expect(hashNumber("07700900001", secret)).not.toBe(hashNumber("07700900001", `${secret}2`));
  });

  it("never contains the number", () => {
    expect(hashNumber("07700900001", secret)).not.toContain("7700900001");
  });

  it("keeps only the last four digits for display", () => {
    expect(last4("07700900001")).toBe("0001");
  });

  it("refuses a missing or short secret", () => {
    expect(() => senderHashSecret({})).toThrow();
    expect(() => senderHashSecret({ SENDER_HASH_SECRET: "short" })).toThrow();
    expect(senderHashSecret({ SENDER_HASH_SECRET: secret })).toBe(secret);
  });
});

import { describe, expect, it } from "vitest";
import { hashSender, senderHashSecret, senderKey } from "../src/core/identity";
import { secret } from "./helpers";

describe("identity", () => {
  it("qualifies an ID with its channel", () => {
    expect(senderKey("tg", 123456)).toBe("tg:123456");
    expect(senderKey("cli", " alice ")).toBe("cli:alice");
  });

  it("refuses an empty ID or an odd channel name", () => {
    expect(() => senderKey("tg", "")).toThrow();
    expect(() => senderKey("Tele gram", "1")).toThrow();
  });

  it("gives the same ID on different channels different hashes", () => {
    expect(hashSender("tg:1", secret)).not.toBe(hashSender("cli:1", secret));
  });

  it("gives a different hash under a different secret, and never contains the ID", () => {
    expect(hashSender("tg:987654321", secret)).not.toBe(hashSender("tg:987654321", `${secret}2`));
    expect(hashSender("tg:987654321", secret)).not.toContain("987654321");
  });

  it("refuses a missing or short secret", () => {
    expect(() => senderHashSecret({})).toThrow();
    expect(() => senderHashSecret({ SENDER_HASH_SECRET: "short" })).toThrow();
    expect(senderHashSecret({ SENDER_HASH_SECRET: secret })).toBe(secret);
  });
});

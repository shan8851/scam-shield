import { randomUUID } from "node:crypto";
import { openPglite, type Db } from "../src/db/client";
import type { Forward } from "../src/core/forward";
import type { RunState } from "../src/agent/hooks";

export const secret = "test-secret-".padEnd(40, "x");

export const freshDb = (): Promise<Db> => openPglite();

/** Test senders, as channel-qualified keys. */
export const numbers = {
  alice: "cli:alice",
  bob: "cli:bob",
  stranger: "cli:stranger",
};

export function forward(from: string, at: Date, overrides: Partial<Forward> = {}): Forward {
  return {
    externalId: `test-${randomUUID()}`,
    sender: { key: from },
    kind: "text",
    text: "Your parcel is held. Pay £1.99 at hxxps://parcel-fee[.]example",
    receivedAt: at,
    ...overrides,
  };
}

export const minutes = (base: Date, n: number) => new Date(base.getTime() + n * 60_000);

/** A fresh agent run state, for hook and policy tests. */
export const state = (over: Partial<RunState> = {}): RunState => ({
  now: new Date("2026-11-20T12:00:00Z"),
  turns: 0,
  tokens: 0,
  elapsedMs: 0,
  lookupsMade: 0,
  textDomains: [],
  hasImages: false,
  lookupResults: [],
  ...over,
});

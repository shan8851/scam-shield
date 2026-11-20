import { describe, expect, it } from "vitest";
import { runPhase, type Hook, type TraceEntry } from "../src/agent/hooks";
import { state } from "./helpers";


const allow: Hook<number> = { name: "allow", run: () => ({ action: "allow" }) };
const double: Hook<number> = { name: "double", run: (_s, v) => ({ action: "replace", value: v * 2, reason: "doubled" }) };
const blockBig: Hook<number> = { name: "block_big", run: (_s, v) => (v > 5 ? { action: "block", reason: "too big" } : { action: "allow" }) };

describe("runPhase", () => {
  it("passes the value through when every hook allows", async () => {
    const trace: TraceEntry[] = [];
    expect(await runPhase("preTool", [allow, allow], state(), 3, trace)).toEqual({ ok: true, value: 3 });
    expect(trace).toHaveLength(2);
  });

  it("lets later hooks see an earlier replacement", async () => {
    const trace: TraceEntry[] = [];
    const result = await runPhase("preTool", [double, blockBig], state(), 3, trace);
    expect(result).toEqual({ ok: false, hook: "block_big", reason: "too big" });
    expect(trace.map((t) => t.action)).toEqual(["replace", "block"]);
  });

  it("stops at the first block: later hooks don't run", async () => {
    const trace: TraceEntry[] = [];
    await runPhase("preTool", [blockBig, double], state(), 9, trace);
    expect(trace.map((t) => t.hook)).toEqual(["block_big"]);
  });
});

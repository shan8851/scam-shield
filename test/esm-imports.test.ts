import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Vercel compiles each file under api/ and src/ on its own and runs it as an
 * ES module, where a relative import must name its file (`./gate.js`).
 * Locally, tsx and vitest resolve extensionless imports anyway, so a missing
 * extension only shows up as a crash in production. This test catches it.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("deployable imports", () => {
  it("give every relative import in src/ and api/ an explicit .js extension", () => {
    const missing = [...files("src"), ...files("api")].flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/(?:from|import)\s+["'](\.{1,2}\/[^"']+)["']/g)]
        .map((m) => m[1]!)
        .filter((spec) => !spec.endsWith(".js") && !spec.endsWith(".json"))
        .map((spec) => `${file}: ${spec}`),
    );
    expect(missing).toEqual([]);
  });
});

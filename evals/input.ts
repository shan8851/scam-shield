import { readFileSync } from "node:fs";
import { refang } from "../src/agent/domains";
import type { CheckInput } from "../src/agent/loop";
import type { EvalCase } from "./types";

const screenshotDir = new URL("./screenshots/", import.meta.url).pathname;

/**
 * What the model gets for a case: the (refanged) text and the screenshot
 * bytes. Nothing else: not the id, title, label, notes or file names.
 */
export function inputFor(c: EvalCase): CheckInput {
  return {
    text: c.text ? refang(c.text) : undefined,
    images: (c.screenshots ?? []).map((_, i) => ({
      mediaType: "image/png" as const,
      data: readFileSync(`${screenshotDir}${c.id}-${i + 1}.png`).toString("base64"),
    })),
  };
}

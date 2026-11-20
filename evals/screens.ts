import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { refang } from "../src/agent/domains";
import { cases } from "./cases";
import { renderTemplate } from "./templates";
import type { Screenshot } from "./types";

/**
 * Renders every case's screenshots to evals/screenshots/<id>-<n>.png with
 * headless Chrome. Run after adding or editing a case; the PNGs are
 * committed so the eval (and CI) never needs a browser.
 */
const chrome = process.env.CHROME ?? "google-chrome";
const outDir = new URL("./screenshots/", import.meta.url).pathname;
const work = mkdtempSync(join(tmpdir(), "scam-shield-screens-"));

const refangAll = (s: Screenshot): Screenshot => JSON.parse(refang(JSON.stringify(s)));

try {
  for (const c of cases) {
    (c.screenshots ?? []).forEach((shot, i) => {
      const html = join(work, `${c.id}-${i + 1}.html`);
      const png = join(outDir, `${c.id}-${i + 1}.png`);
      writeFileSync(html, renderTemplate(refangAll(shot)));
      execFileSync(chrome, [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=2",
        "--window-size=390,844",
        `--screenshot=${png}`,
        `file://${html}`,
      ], { stdio: "ignore" });
      console.log(`rendered ${c.id}-${i + 1}.png`);
    });
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

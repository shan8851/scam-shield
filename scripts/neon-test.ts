import { execFileSync } from "node:child_process";

/** Runs the Neon lock test with NEON_TEST_URL (falling back to DATABASE_URL from .env, the dev branch). */
try {
  process.loadEnvFile(".env");
} catch {
  // Use the environment as it is.
}
const url = process.env.NEON_TEST_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Set NEON_TEST_URL or DATABASE_URL to a Neon dev branch");
execFileSync("npx", ["vitest", "run", "test/neon-lock.test.ts"], { stdio: "inherit", env: { ...process.env, NEON_TEST_URL: url } });

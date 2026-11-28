import { migrateNeonDb } from "../src/db/neon";

/** Applies migrations to the database in DATABASE_URL (the Neon dev branch locally, production on deploy). */
try {
  process.loadEnvFile(".env");
} catch {
  // On Vercel the environment provides it.
}
// Preview deployments (PR branches) deliberately have no DATABASE_URL, so an
// unmerged migration can never reach production. Skip rather than fail.
if (process.env.VERCEL_ENV === "preview") {
  console.log("preview deployment: migrations skipped");
  process.exit(0);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
await migrateNeonDb(url);
console.log("migrations applied");

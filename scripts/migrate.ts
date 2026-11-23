import { migrateNeonDb } from "../src/db/neon";

/** Applies migrations to the database in DATABASE_URL (the Neon dev branch locally, production on deploy). */
try {
  process.loadEnvFile(".env");
} catch {
  // On Vercel the environment provides it.
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
await migrateNeonDb(url);
console.log("migrations applied");

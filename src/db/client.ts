import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

/**
 * The database type the core works against. Any Postgres driver Drizzle
 * supports fits it, so the core doesn't care whether it's PGlite (local and
 * tests, this file) or Neon (deployed, `neon.ts`). They're kept apart so the
 * deployed function never bundles PGlite.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const migrationsFolder = new URL("../../drizzle", import.meta.url).pathname;

/**
 * Opens a PGlite database and applies all migrations. With no `dataDir` the
 * database lives in memory, which is what the tests use.
 */
export async function openPglite(dataDir?: string): Promise<Db> {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as Db;
}

/** Closes the underlying PGlite instance so a CLI process can exit. */
export async function closePglite(db: Db): Promise<void> {
  await (db as unknown as { $client: PGlite }).$client.close();
}

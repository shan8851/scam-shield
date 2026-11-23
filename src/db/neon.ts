import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import type { Db } from "./client";
import * as schema from "./schema";

/**
 * Opens Neon (deployed, and the lock test) over its WebSocket pool, which
 * supports real transactions and so the gate's advisory lock. Migrations
 * are applied separately, with `pnpm db:migrate`.
 */
export function openNeon(url: string): { db: Db; close: () => Promise<void> } {
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema }) as unknown as Db;
  return { db, close: () => pool.end() };
}

/** Applies all migrations to a Neon database. */
export async function migrateNeonDb(url: string): Promise<void> {
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool, { schema }), { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
  } finally {
    await pool.end();
  }
}

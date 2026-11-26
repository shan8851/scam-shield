import { timingSafeEqual } from "node:crypto";
import { applyRetention } from "../../src/core/retention.js";
import { openNeon } from "../../src/db/neon.js";

/**
 * The daily retention job, run by Vercel Cron (see vercel.json). Vercel sends
 * the project's CRON_SECRET as a bearer token; anything else is refused.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("forbidden", { status: 403 });
  }
  const url = process.env.DATABASE_URL;
  if (!url) return new Response("DATABASE_URL is not set", { status: 500 });
  const { db, close } = openNeon(url);
  try {
    const result = await applyRetention(db);
    console.log(JSON.stringify({ event: "retention_run", ...result }));
    return Response.json(result);
  } finally {
    await close();
  }
}

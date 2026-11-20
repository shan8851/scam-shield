import { sql } from "drizzle-orm";
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Everyone who has ever messaged the bot, keyed by a keyed hash of their
 * number. Plain phone numbers are never stored.
 *
 * - `pending`: messaged once, waiting for an approve or deny. Only pending
 *   rows keep `last4` and `profileName`, so the admin can tell who it is.
 * - `allowed`: invited; their messages reach the gate's limits.
 * - `denied`: ignored silently from now on.
 */
export const senders = pgTable("senders", {
  id: uuid("id").primaryKey().defaultRandom(),
  numberHash: text("number_hash").notNull().unique(),
  status: text("status", { enum: ["pending", "allowed", "denied"] }).notNull(),
  nickname: text("nickname"),
  last4: text("last4"),
  profileName: text("profile_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

/**
 * Inbound messages. `externalId` is the channel's own message ID (Meta's
 * `wamid` on WhatsApp) and is unique, which is what makes redelivered
 * webhooks harmless. Content is kept only for allowed senders, and is
 * deleted by the retention job after 30 days.
 */
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: text("external_id").notNull().unique(),
  senderId: uuid("sender_id").references(() => senders.id),
  kind: text("kind", {
    enum: ["text", "image", "voice", "document", "video", "other"],
  }).notNull(),
  text: text("text"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  checkId: uuid("check_id").references(() => checks.id),
});

/**
 * One row per admitted check. The gate counts these rows in sliding windows
 * to enforce the per-sender cool-off and the global daily budget; the agent
 * records its outcome and trace on the same row.
 */
export const checks = pgTable(
  "checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: uuid("sender_id").notNull().references(() => senders.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: ["running", "done", "failed"] }).notNull().default("running"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    /** The verdict after preSend hooks, as structured enums. */
    verdict: jsonb("verdict").$type<Record<string, unknown>>(),
    failure: text("failure"),
    /** What the harness did and decided, step by step. Never message text. */
    trace: jsonb("trace").$type<unknown[]>(),
    tokens: integer("tokens"),
  },
  (t) => [index("checks_sender_created_idx").on(t.senderId, t.createdAt)],
);

/**
 * Append-only record of every policy decision. A database trigger rejects
 * UPDATE, DELETE and TRUNCATE (see the custom migration), so not even this
 * app's own code can rewrite it. It never holds phone numbers or message text.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().default(sql`now()`),
    senderId: uuid("sender_id"),
    event: text("event").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
  },
  (t) => [index("audit_log_sender_event_at_idx").on(t.senderId, t.event, t.at)],
);

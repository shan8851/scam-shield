import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Everyone who has ever messaged the bot, keyed by a keyed hash of a
 * channel-qualified sender ID (for example "tg:123456"). Raw IDs, phone
 * numbers and usernames are never stored for decided senders.
 *
 * - `pending`: messaged once, waiting for an approve or deny. Only pending
 *   rows keep `displayName`, `username` and `contactRef` (the channel's chat
 *   ID, used once to welcome them if approved), so the admin can tell who it
 *   is. All three are cleared when the admin decides.
 * - `allowed`: invited; their messages reach the gate's limits.
 * - `denied`: ignored silently from now on.
 */
export const senders = pgTable("senders", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderHash: text("sender_hash").notNull().unique(),
  status: text("status", { enum: ["pending", "allowed", "denied"] }).notNull(),
  nickname: text("nickname"),
  displayName: text("display_name"),
  username: text("username"),
  contactRef: text("contact_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

/**
 * Inbound messages from allowed senders. `externalId` is the channel's own
 * update ID and is unique, which is what makes redelivered webhooks
 * harmless. `mediaRefs` are the channel's references to attached images
 * (Telegram file IDs), never the image bytes. Text and references are
 * deleted by the retention job after 30 days.
 *
 * - `queued`: waiting for the gathering window to claim it.
 * - `claimed`: part of a check (`checkId`).
 * - `dropped`: never checked (an unsupported kind, or a batch the limits
 *   turned away), so it can't resurface in a later batch.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").notNull().unique(),
    senderId: uuid("sender_id").notNull().references(() => senders.id),
    kind: text("kind", {
      enum: ["text", "image", "voice", "document", "video", "other"],
    }).notNull(),
    text: text("text"),
    mediaRefs: jsonb("media_refs").$type<string[]>(),
    forwarded: boolean("forwarded").notNull().default(false),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: ["queued", "claimed", "dropped"] }).notNull().default("queued"),
    checkId: uuid("check_id").references(() => checks.id),
  },
  (t) => [index("messages_sender_status_idx").on(t.senderId, t.status, t.receivedAt)],
);

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
 * app's own code can rewrite it. It never holds sender IDs, names or message text.
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

/**
 * Runtime switches the admin can change without a redeploy. Today just one:
 * `paused`, the kill switch. Every change is audit-logged.
 */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

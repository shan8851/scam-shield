CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"sender_id" uuid,
	"event" text NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"finished_at" timestamp with time zone,
	"verdict" jsonb,
	"failure" text,
	"trace" jsonb,
	"tokens" integer
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"sender_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"text" text,
	"media_refs" jsonb,
	"forwarded" boolean DEFAULT false NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"check_id" uuid,
	CONSTRAINT "messages_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "senders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_hash" text NOT NULL,
	"status" text NOT NULL,
	"nickname" text,
	"display_name" text,
	"username" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "senders_sender_hash_unique" UNIQUE("sender_hash")
);
--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_sender_id_senders_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."senders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_senders_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."senders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_sender_event_at_idx" ON "audit_log" USING btree ("sender_id","event","at");--> statement-breakpoint
CREATE INDEX "checks_sender_created_idx" ON "checks" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_sender_status_idx" ON "messages" USING btree ("sender_id","status","received_at");
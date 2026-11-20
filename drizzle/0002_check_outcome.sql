ALTER TABLE "checks" ADD COLUMN "status" text DEFAULT 'running' NOT NULL;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "verdict" jsonb;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "failure" text;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "trace" jsonb;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "tokens" integer;
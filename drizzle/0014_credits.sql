ALTER TABLE "ai_runs" ADD COLUMN "credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;
ALTER TABLE "idea_buckets" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "idea_buckets" ADD CONSTRAINT "idea_buckets_share_token_unique" UNIQUE("share_token");
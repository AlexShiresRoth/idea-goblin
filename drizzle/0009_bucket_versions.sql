CREATE TABLE "bucket_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"bucket_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"theme" text NOT NULL,
	"ideas" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bucket_versions" ADD CONSTRAINT "bucket_versions_bucket_id_idea_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."idea_buckets"("id") ON DELETE cascade ON UPDATE no action;
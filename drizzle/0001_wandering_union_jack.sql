CREATE TABLE "idea_bucket_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"idea_id" integer NOT NULL,
	"bucket_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "status" text DEFAULT 'incubating' NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "profile_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "idea_bucket_links" ADD CONSTRAINT "idea_bucket_links_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_bucket_links" ADD CONSTRAINT "idea_bucket_links_bucket_id_idea_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."idea_buckets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_buckets" DROP COLUMN "ideas";--> statement-breakpoint
ALTER TABLE "ideas" DROP COLUMN "active";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "active_ideas";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "ideas";
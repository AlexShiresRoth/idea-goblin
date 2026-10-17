CREATE TABLE "analysis_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"analysis_type" text NOT NULL,
	"analysis_data" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idea_buckets" ALTER COLUMN "theme" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_profile_id_profiles_user_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
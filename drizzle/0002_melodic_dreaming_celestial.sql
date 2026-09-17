ALTER TABLE "ideas" DROP CONSTRAINT "ideas_profile_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "ideas" DROP COLUMN "profile_id";
--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "type" text DEFAULT 'idea' NOT NULL;
--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "id";
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "user_id" uuid PRIMARY KEY NOT NULL;
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "profile_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_profile_id_profiles_user_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;

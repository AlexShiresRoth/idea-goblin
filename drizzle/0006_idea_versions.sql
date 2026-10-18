ALTER TABLE "ideas" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_parent_id_ideas_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "idea_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"idea_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idea_versions" ADD CONSTRAINT "idea_versions_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;
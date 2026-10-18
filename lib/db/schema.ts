import type { AnalysisPayload, PathwayId } from "@/lib/types";
import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const profileTable = pgTable("profiles", {
  id: uuid("user_id")
    .primaryKey()
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  activeIdeasAmt: integer("active_ideas_amt").notNull().default(2),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ideaBucketsTable = pgTable("idea_buckets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  theme: text("theme").notNull().default(""),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profileTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ideaBucketLinksTable = pgTable("idea_bucket_links", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id")
    .notNull()
    .references(() => ideasTable.id, { onDelete: "cascade" }),
  bucketId: integer("bucket_id")
    .notNull()
    .references(() => ideaBucketsTable.id, { onDelete: "cascade" }),
});

export const ideasTable = pgTable("ideas", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull().default("incubating"),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profileTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  type: text("type").notNull().default("idea"),
  description: text("description").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  parentId: integer("parent_id").references((): AnyPgColumn => ideasTable.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ideaVersionsTable = pgTable("idea_versions", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id")
    .notNull()
    .references(() => ideasTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const analysisResultsTable = pgTable("analysis_results", {
  id: serial("id").primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profileTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  analysisType: text("analysis_type").$type<PathwayId>().notNull(),
  analysisData: jsonb("analysis_data").$type<AnalysisPayload>().notNull(),
});

// One row per model call: usage for cost tracking, plus the result keyed by
// an input hash so unchanged inputs can be served without a new call.
export const aiRunsTable = pgTable(
  "ai_runs",
  {
    id: serial("id").primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profileTable.id, { onDelete: "cascade" }),
    route: text("route").notNull(),
    model: text("model").notNull(),
    inputHash: text("input_hash"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    reasoningTokens: integer("reasoning_tokens").notNull().default(0),
    result: jsonb("result"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_runs_profile_route_created_idx").on(
      table.profileId,
      table.route,
      table.createdAt,
    ),
  ],
);

export type Idea = typeof ideasTable.$inferSelect;
export type IdeaView = Omit<Idea, "embedding">;
export type IdeaVersion = typeof ideaVersionsTable.$inferSelect;
export type IdeaBucket = typeof ideaBucketsTable.$inferSelect;
export type AnalysisResult = typeof analysisResultsTable.$inferSelect;
export type AiRun = typeof aiRunsTable.$inferSelect;

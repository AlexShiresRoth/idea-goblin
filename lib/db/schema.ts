import {
  integer,
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Idea = typeof ideasTable.$inferSelect;
export type IdeaBucket = typeof ideaBucketsTable.$inferSelect;

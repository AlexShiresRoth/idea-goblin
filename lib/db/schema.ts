import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const profileTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  activeIdeasAmt: integer("active_ideas_amt").notNull().default(2),
  activeIdeas: jsonb("active_ideas").notNull().default([]),
  ideas: jsonb("ideas").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ideasTable = pgTable("ideas", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  active: boolean("active").notNull().default(true),
  category: text("category").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

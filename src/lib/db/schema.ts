import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const conversions = sqliteTable("conversions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commitSha: text("commit_sha").notNull(),
  commitMessage: text("commit_message"),
  branch: text("branch").default("main"),
  status: text("status", {
    enum: ["pending", "analyzing", "converting", "pushing", "deploying", "done", "error", "waiting_answers"],
  }).notNull().default("pending"),
  errorMessage: text("error_message"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
});

export const rules = sqliteTable("rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  componentPath: text("component_path").notNull().unique(),
  mode: text("mode", { enum: ["static", "island"] }).notNull(),
  hydrationDirective: text("hydration_directive", {
    enum: ["client:load", "client:visible", "client:idle", "client:only"],
  }),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversionId: integer("conversion_id").notNull().references(() => conversions.id),
  componentPath: text("component_path").notNull(),
  questionText: text("question_text").notNull(),
  context: text("context"),
  answer: text("answer"),
  answeredAt: text("answered_at"),
  createdAt: text("created_at").notNull(),
});

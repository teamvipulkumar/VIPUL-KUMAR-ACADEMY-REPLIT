import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const codeSnippetsTable = pgTable("code_snippets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default(""),
  code: text("code").notNull().default(""),
  placement: text("placement", { enum: ["head", "body_start", "body_end"] })
    .notNull()
    .default("head"),
  enabled: boolean("enabled").notNull().default(true),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CodeSnippet = typeof codeSnippetsTable.$inferSelect;
export type CodeSnippetPlacement = "head" | "body_start" | "body_end";

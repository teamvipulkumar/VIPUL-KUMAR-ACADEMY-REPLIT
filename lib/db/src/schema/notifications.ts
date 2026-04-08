import { pgTable, serial, timestamp, integer, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", { enum: ["info", "success", "warning", "error"] }).notNull().default("info"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformSettingsTable = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  siteName: text("site_name").notNull().default("EduPro"),
  siteDescription: text("site_description").notNull().default("Learn and grow with our courses"),
  commissionRate: integer("commission_rate").notNull().default(20),
  currency: text("currency").notNull().default("USD"),
  stripeEnabled: boolean("stripe_enabled").notNull().default(true),
  razorpayEnabled: boolean("razorpay_enabled").notNull().default(false),
  emailNotificationsEnabled: boolean("email_notifications_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;

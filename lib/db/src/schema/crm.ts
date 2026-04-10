import { pgTable, serial, timestamp, integer, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const smtpSettingsTable = pgTable("smtp_settings", {
  id: serial("id").primaryKey(),
  host: text("host").notNull().default(""),
  port: integer("port").notNull().default(587),
  secure: boolean("secure").notNull().default(false),
  username: text("username").notNull().default(""),
  password: text("password").notNull().default(""),
  fromName: text("from_name").notNull().default("VK Academy"),
  fromEmail: text("from_email").notNull().default(""),
  isActive: boolean("is_active").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const emailTemplatesTable = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["welcome", "purchase", "refund", "forgot_password", "remarketing", "completion", "affiliate_commission", "custom"],
  }).notNull().default("custom"),
  subject: text("subject").notNull(),
  htmlBody: text("html_body").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const emailCampaignsTable = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  templateId: integer("template_id").references(() => emailTemplatesTable.id, { onDelete: "set null" }),
  htmlBody: text("html_body").notNull(),
  status: text("status", { enum: ["draft", "sending", "sent", "failed"] }).notNull().default("draft"),
  recipientFilter: text("recipient_filter", { enum: ["all", "enrolled", "not_enrolled"] }).notNull().default("all"),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailAutomationRulesTable = pgTable("email_automation_rules", {
  id: serial("id").primaryKey(),
  event: text("event", {
    enum: ["welcome", "purchase", "refund", "forgot_password", "remarketing", "completion", "affiliate_commission"],
  }).notNull().unique(),
  templateId: integer("template_id").references(() => emailTemplatesTable.id, { onDelete: "set null" }),
  isEnabled: boolean("is_enabled").notNull().default(false),
  delayMinutes: integer("delay_minutes").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const emailSendsTable = pgTable("email_sends", {
  id: serial("id").primaryKey(),
  type: text("type", { enum: ["campaign", "automation", "test"] }).notNull(),
  campaignId: integer("campaign_id").references(() => emailCampaignsTable.id, { onDelete: "set null" }),
  automationEvent: text("automation_event"),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  status: text("status", { enum: ["sent", "failed"] }).notNull().default("sent"),
  failReason: text("fail_reason"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSmtpSettingsSchema = createInsertSchema(smtpSettingsTable).omit({ id: true, updatedAt: true });
export type InsertSmtpSettings = z.infer<typeof insertSmtpSettingsSchema>;
export type SmtpSettings = typeof smtpSettingsTable.$inferSelect;

export const insertEmailTemplateSchema = createInsertSchema(emailTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplatesTable.$inferSelect;

export const insertEmailCampaignSchema = createInsertSchema(emailCampaignsTable).omit({ id: true, createdAt: true, sentAt: true, sentCount: true, failedCount: true });
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type EmailCampaign = typeof emailCampaignsTable.$inferSelect;

export const insertEmailAutomationRuleSchema = createInsertSchema(emailAutomationRulesTable).omit({ id: true, updatedAt: true });
export type InsertEmailAutomationRule = z.infer<typeof insertEmailAutomationRuleSchema>;
export type EmailAutomationRule = typeof emailAutomationRulesTable.$inferSelect;

export const insertEmailSendSchema = createInsertSchema(emailSendsTable).omit({ id: true, sentAt: true });
export type InsertEmailSend = z.infer<typeof insertEmailSendSchema>;
export type EmailSend = typeof emailSendsTable.$inferSelect;

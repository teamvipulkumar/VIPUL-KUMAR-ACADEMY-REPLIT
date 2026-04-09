import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const paymentGatewaysTable = pgTable("payment_gateways", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  apiKey: text("api_key").notNull().default(""),
  secretKey: text("secret_key").notNull().default(""),
  webhookSecret: text("webhook_secret"),
  extraConfig: text("extra_config"),
  isActive: boolean("is_active").notNull().default(false),
  isTestMode: boolean("is_test_mode").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

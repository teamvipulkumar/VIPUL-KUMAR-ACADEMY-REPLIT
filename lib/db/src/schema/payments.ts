import { pgTable, serial, timestamp, integer, numeric, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { coursesTable } from "./courses";
import { bundlesTable } from "./bundles";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id").references(() => coursesTable.id, { onDelete: "set null" }),
  bundleId: integer("bundle_id").references(() => bundlesTable.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status", { enum: ["pending", "completed", "failed", "refunded"] }).notNull().default("pending"),
  gateway: text("gateway", { enum: ["stripe", "razorpay", "cashfree", "paytm", "payu"] }).notNull(),
  sessionId: text("session_id").notNull().unique(),
  paymentId: text("payment_id"),
  gatewayOrderId: text("gateway_order_id"),
  couponCode: text("coupon_code"),
  affiliateRef: text("affiliate_ref"),
  billingName: text("billing_name"),
  billingEmail: text("billing_email"),
  billingMobile: text("billing_mobile"),
  billingState: text("billing_state"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;

import { pgTable, serial, timestamp, integer, numeric, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { coursesTable } from "./courses";
import { bundlesTable } from "./bundles";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  // Nullable on purpose: for guest checkouts (new email, not logged in) we
  // defer user-account creation until the gateway confirms the payment.
  // The user row is created in `ensureUserForPayment()` at success time.
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
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
  // bcrypt hash of the auto-generated guest password. Only present on rows
  // where userId is null (i.e. user has not yet been created). Cleared when
  // ensureUserForPayment() materialises the user at payment-success time.
  pendingPasswordHash: text("pending_password_hash"),
  // SECURITY: tracks whether the requester is allowed to be auto-logged-in
  // when this payment captures. Set at create-order time:
  //   • true  → requester was already authenticated as the resolved user, OR
  //              the email was brand-new and we're creating the account from
  //              this checkout's pendingPasswordHash (so the requester has the
  //              temp password from sessionStorage).
  //   • false → guest checkout where the typed email matched an EXISTING user
  //              account that the requester did not authenticate as. They get
  //              the course / bundle they paid for, but MUST NOT be logged
  //              into the existing account without verifying ownership.
  // All post-capture cookie sets must gate on this column.
  allowAutoLogin: boolean("allow_auto_login").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;

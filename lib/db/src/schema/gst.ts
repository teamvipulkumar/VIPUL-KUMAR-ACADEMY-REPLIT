import { pgTable, serial, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { paymentsTable } from "./payments";
import { usersTable } from "./users";
import { coursesTable } from "./courses";

export const gstCompanySettingsTable = pgTable("gst_company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default(""),
  gstin: text("gstin").notNull().default(""),
  addressLine1: text("address_line1").notNull().default(""),
  addressLine2: text("address_line2").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  stateCode: text("state_code").notNull().default(""),
  pincode: text("pincode").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  logoUrl: text("logo_url"),
  gstRate: integer("gst_rate").notNull().default(18),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const gstInvoicesTable = pgTable("gst_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  paymentId: integer("payment_id").references(() => paymentsTable.id, { onDelete: "set null" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  courseId: integer("course_id").references(() => coursesTable.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull().default(""),
  customerEmail: text("customer_email").notNull().default(""),
  customerGstin: text("customer_gstin"),
  customerAddress: text("customer_address").notNull().default(""),
  customerState: text("customer_state").notNull().default(""),
  customerStateCode: text("customer_state_code").notNull().default(""),
  courseTitle: text("course_title").notNull().default(""),
  baseAmount: numeric("base_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  gstRate: integer("gst_rate").notNull().default(18),
  cgstAmount: numeric("cgst_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  igstAmount: numeric("igst_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  isInterstate: boolean("is_interstate").notNull().default(false),
  financialYear: text("financial_year").notNull().default(""),
  gateway: text("gateway").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GstCompanySettings = typeof gstCompanySettingsTable.$inferSelect;
export type GstInvoice = typeof gstInvoicesTable.$inferSelect;

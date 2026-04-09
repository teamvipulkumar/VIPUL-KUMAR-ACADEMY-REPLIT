import { pgTable, serial, timestamp, integer, numeric, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { coursesTable } from "./courses";

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  referredUserId: integer("referred_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  courseId: integer("course_id").references(() => coursesTable.id, { onDelete: "set null" }),
  status: text("status", { enum: ["click", "signup", "purchase"] }).notNull().default("click"),
  commission: numeric("commission", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payoutRequestsTable = pgTable("payout_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentDetails: text("payment_details").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const affiliateApplicationsTable = pgTable("affiliate_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  promoteDescription: text("promote_description").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  adminNote: text("admin_note"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  isBlocked: boolean("is_blocked").notNull().default(false),
  commissionOverride: integer("commission_override"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const affiliateClicksTable = pgTable("affiliate_clicks", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  courseId: integer("course_id").references(() => coursesTable.id, { onDelete: "set null" }),
  isUnique: boolean("is_unique").notNull().default(true),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const affiliateKycTable = pgTable("affiliate_kyc", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  idProofUrl: text("id_proof_url"),
  addressProofUrl: text("address_proof_url"),
  idProofName: text("id_proof_name"),
  addressProofName: text("address_proof_name"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  adminNote: text("admin_note"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const affiliateBankDetailsTable = pgTable("affiliate_bank_details", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  accountHolderName: text("account_holder_name").notNull(),
  accountNumber: text("account_number").notNull(),
  ifscCode: text("ifsc_code").notNull(),
  bankName: text("bank_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const affiliateCreativesTable = pgTable("affiliate_creatives", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type", { enum: ["image", "banner", "text"] }).notNull(),
  url: text("url"),
  content: text("content"),
  description: text("description"),
  uploadedByAdminId: integer("uploaded_by_admin_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const affiliatePixelTable = pgTable("affiliate_pixels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  facebookPixelId: text("facebook_pixel_id"),
  trackPageView: boolean("track_page_view").notNull().default(true),
  trackPurchase: boolean("track_purchase").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReferralSchema = createInsertSchema(referralsTable).omit({ id: true, createdAt: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referralsTable.$inferSelect;

export const insertPayoutRequestSchema = createInsertSchema(payoutRequestsTable).omit({ id: true, requestedAt: true });
export type InsertPayoutRequest = z.infer<typeof insertPayoutRequestSchema>;
export type PayoutRequest = typeof payoutRequestsTable.$inferSelect;

export const insertAffiliateApplicationSchema = createInsertSchema(affiliateApplicationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAffiliateApplication = z.infer<typeof insertAffiliateApplicationSchema>;
export type AffiliateApplication = typeof affiliateApplicationsTable.$inferSelect;

export const insertAffiliateClickSchema = createInsertSchema(affiliateClicksTable).omit({ id: true, createdAt: true });
export type InsertAffiliateClick = z.infer<typeof insertAffiliateClickSchema>;

export const insertAffiliateKycSchema = createInsertSchema(affiliateKycTable).omit({ id: true, submittedAt: true });
export type InsertAffiliateKyc = z.infer<typeof insertAffiliateKycSchema>;

export const insertAffiliateBankDetailsSchema = createInsertSchema(affiliateBankDetailsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAffiliateBankDetails = z.infer<typeof insertAffiliateBankDetailsSchema>;

export const insertAffiliateCreativeSchema = createInsertSchema(affiliateCreativesTable).omit({ id: true, createdAt: true });
export type InsertAffiliateCreative = z.infer<typeof insertAffiliateCreativeSchema>;

export const insertAffiliatePixelSchema = createInsertSchema(affiliatePixelTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAffiliatePixel = z.infer<typeof insertAffiliatePixelSchema>;

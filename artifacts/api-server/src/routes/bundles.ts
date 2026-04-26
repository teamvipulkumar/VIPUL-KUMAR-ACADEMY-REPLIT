import { Router } from "express";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  bundlesTable, bundleCoursesTable, coursesTable, paymentsTable,
  enrollmentsTable, notificationsTable, usersTable, couponsTable,
  platformSettingsTable, paymentGatewaysTable, referralsTable, affiliateClicksTable,
  affiliateApplicationsTable, commissionGroupsTable,
} from "@workspace/db";
import { eq, and, desc, or, isNull } from "drizzle-orm";
import { requireAuth, requireAdmin, signToken, verifyToken, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";
import { triggerAutomation, triggerFunnel } from "./crm";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PaytmChecksum = require("paytmchecksum");

const router = Router();
type AuthedRequest = Request & { user: JwtPayload };

/* ── Helpers ─────────────────────────────────────────────────────────────── */
async function getBundleWithCourses(bundleId: number) {
  const [bundle] = await db.select().from(bundlesTable).where(eq(bundlesTable.id, bundleId)).limit(1);
  if (!bundle) return null;
  const bundleCourses = await db
    .select({
      id: coursesTable.id,
      title: coursesTable.title,
      description: coursesTable.description,
      thumbnailUrl: coursesTable.thumbnailUrl,
      price: coursesTable.price,
      category: coursesTable.category,
      level: coursesTable.level,
      durationMinutes: coursesTable.durationMinutes,
    })
    .from(bundleCoursesTable)
    .leftJoin(coursesTable, eq(bundleCoursesTable.courseId, coursesTable.id))
    .where(eq(bundleCoursesTable.bundleId, bundleId));
  return {
    ...bundle,
    price: parseFloat(String(bundle.price)),
    compareAtPrice: bundle.compareAtPrice ? parseFloat(String(bundle.compareAtPrice)) : null,
    courses: bundleCourses.filter(c => c.id !== null).map(c => ({
      ...c,
      price: parseFloat(String(c.price)),
    })),
  };
}

async function enrollInBundle(bundleId: number, userId: number, affiliateRef?: string | null): Promise<{ enrolledCourses: number[]; bundleName: string }> {
  const bundle = await getBundleWithCourses(bundleId);
  if (!bundle) throw new Error("Bundle not found");

  const enrolledCourses: number[] = [];
  for (const course of bundle.courses) {
    if (!course.id) continue;
    const [existing] = await db.select().from(enrollmentsTable).where(
      and(eq(enrollmentsTable.userId, userId), eq(enrollmentsTable.courseId, course.id))
    ).limit(1);
    if (!existing) {
      await db.insert(enrollmentsTable).values({ userId, courseId: course.id });
      enrolledCourses.push(course.id);
    }
  }

  await db.insert(notificationsTable).values({
    userId,
    title: "Package Enrolled! 🎉",
    message: `You now have access to all ${bundle.courses.length} courses in "${bundle.name}".`,
    type: "success",
  });

  const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (buyer) {
    triggerAutomation("purchase", buyer.id, buyer.email, {
      name: buyer.name, email: buyer.email, course_name: bundle.name,
    }).catch(() => {});
    triggerFunnel("new_purchase", buyer.id, {
      course_name: bundle.name,
      amount: String(bundle.price.toFixed(2)),
      site_url: process.env.SITE_URL || "",
    }).catch(() => {});
  }

  if (affiliateRef) {
    try {
      const [referrer] = await db.select({ id: usersTable.id, role: usersTable.role, name: usersTable.name, email: usersTable.email }).from(usersTable)
        .where(eq(usersTable.referralCode, affiliateRef)).limit(1);
      if (referrer && referrer.id !== userId) {
        // Resolve commission rate: individual override → group → platform default
        const [settings] = await db.select({ commissionRate: platformSettingsTable.commissionRate })
          .from(platformSettingsTable).limit(1);
        let rate = settings?.commissionRate ?? 20;

        const [app] = await db.select({
          commissionOverride: affiliateApplicationsTable.commissionOverride,
          commissionGroupId: affiliateApplicationsTable.commissionGroupId,
          isBlocked: affiliateApplicationsTable.isBlocked,
          status: affiliateApplicationsTable.status,
        }).from(affiliateApplicationsTable)
          .where(eq(affiliateApplicationsTable.userId, referrer.id)).limit(1);

        // For affiliates: must have approved, unblocked application
        if (referrer.role === "affiliate" && (!app || app.status !== "approved" || app.isBlocked)) {
          // Not eligible — silently skip commission
        } else {
        if (app?.commissionOverride != null) {
          rate = app.commissionOverride;
        } else if (app?.commissionGroupId != null) {
          const [grp] = await db.select({ commissionRate: commissionGroupsTable.commissionRate })
            .from(commissionGroupsTable).where(eq(commissionGroupsTable.id, app.commissionGroupId)).limit(1);
          if (grp) rate = grp.commissionRate;
        }

        const [payment] = await db.select().from(paymentsTable)
          .where(and(eq(paymentsTable.userId, userId), eq(paymentsTable.bundleId, bundleId)))
          .orderBy(desc(paymentsTable.createdAt)).limit(1);
        if (payment) {
          const commission = parseFloat(((parseFloat(String(payment.amount)) * rate) / 100).toFixed(2));

          // Find an existing click referral (referredUserId is null at click time) to upgrade
          const [clickRef] = await db.select().from(referralsTable)
            .where(and(
              eq(referralsTable.referrerId, referrer.id),
              isNull(referralsTable.referredUserId),
              isNull(referralsTable.courseId),
              eq(referralsTable.status, "click"),
            ))
            .orderBy(desc(referralsTable.createdAt))
            .limit(1);

          if (clickRef) {
            // Update createdAt to NOW so dashboard time-based filters reflect purchase date
            await db.update(referralsTable)
              .set({ status: "purchase", referredUserId: userId, commission: String(commission), createdAt: new Date() })
              .where(eq(referralsTable.id, clickRef.id));
          } else {
            await db.insert(referralsTable).values({
              referrerId: referrer.id,
              referredUserId: userId,
              courseId: null,
              status: "purchase",
              commission: String(commission),
            });
          }

          // Mark any unconverted click as converted
          await db.update(affiliateClicksTable)
            .set({ convertedAt: new Date() })
            .where(and(
              eq(affiliateClicksTable.affiliateId, referrer.id),
              isNull(affiliateClicksTable.courseId),
              isNull(affiliateClicksTable.convertedAt),
            ));

          // Notify the affiliate
          await db.insert(notificationsTable).values({
            userId: referrer.id,
            title: "Commission Earned! 🎉",
            message: `You earned ₹${commission.toFixed(2)} commission from a bundle purchase.`,
            type: "success",
          });

          // Fire CRM automation + funnel for affiliate_commission event (non-blocking)
          const commissionVars = {
            name: referrer.name ?? "",
            commission_amount: commission.toFixed(2),
            payout_amount: commission.toFixed(2),
            site_url: process.env.SITE_URL || "",
          };
          triggerAutomation("affiliate_commission", referrer.id, referrer.email ?? "", commissionVars).catch(e => console.error("[bundle affiliate commission] triggerAutomation error:", e));
          triggerFunnel("affiliate_commission", referrer.id, commissionVars).catch(e => console.error("[bundle affiliate commission] triggerFunnel error:", e));
        }
        } // closes else (eligible affiliate)
      }
    } catch (err) { console.error("[bundle affiliate commission]", err); }
  }

  return { enrolledCourses, bundleName: bundle.name };
}

/* ── Public Routes ───────────────────────────────────────────────────────── */

router.get("/", async (_req, res): Promise<void> => {
  try {
    const bundles = await db.select().from(bundlesTable).where(eq(bundlesTable.isActive, true)).orderBy(desc(bundlesTable.createdAt));
    const enriched = await Promise.all(bundles.map(b => getBundleWithCourses(b.id)));
    res.json(enriched.filter(Boolean));
  } catch {
    res.json([]);
  }
});

router.get("/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid bundle ID" }); return; }
  const bundle = await getBundleWithCourses(id);
  if (!bundle) { res.status(404).json({ error: "Bundle not found" }); return; }
  res.json(bundle);
});

/* ── Admin Routes ────────────────────────────────────────────────────────── */

router.get("/admin/list", requireAdmin, async (_req, res): Promise<void> => {
  const bundles = await db.select().from(bundlesTable).orderBy(desc(bundlesTable.createdAt));
  const enriched = await Promise.all(bundles.map(b => getBundleWithCourses(b.id)));
  res.json(enriched.filter(Boolean));
});

router.post("/admin", requireAdmin, async (req, res): Promise<void> => {
  const { name, slug, description, thumbnailUrl, price, compareAtPrice, isActive, courseIds } = req.body;
  if (!name || !price) { res.status(400).json({ error: "name and price are required" }); return; }
  const generatedSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const [bundle] = await db.insert(bundlesTable).values({
    name,
    slug: generatedSlug,
    description: description || null,
    thumbnailUrl: thumbnailUrl || null,
    price: String(parseFloat(price)),
    compareAtPrice: compareAtPrice ? String(parseFloat(compareAtPrice)) : null,
    isActive: isActive ?? true,
  }).returning();
  if (courseIds?.length) {
    await db.insert(bundleCoursesTable).values(
      (courseIds as number[]).map(cId => ({ bundleId: bundle.id, courseId: cId }))
    );
  }
  const created = await getBundleWithCourses(bundle.id);
  res.status(201).json(created);
});

router.put("/admin/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { name, slug, description, thumbnailUrl, price, compareAtPrice, isActive, courseIds } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) {
    updates.name = name;
    if (!slug) updates.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  if (slug !== undefined) updates.slug = slug;
  if (description !== undefined) updates.description = description || null;
  if (thumbnailUrl !== undefined) updates.thumbnailUrl = thumbnailUrl || null;
  if (price !== undefined) updates.price = String(parseFloat(price));
  if (compareAtPrice !== undefined) updates.compareAtPrice = compareAtPrice ? String(parseFloat(compareAtPrice)) : null;
  if (isActive !== undefined) updates.isActive = isActive;

  const [updated] = await db.update(bundlesTable).set(updates).where(eq(bundlesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Bundle not found" }); return; }

  if (courseIds !== undefined) {
    await db.delete(bundleCoursesTable).where(eq(bundleCoursesTable.bundleId, id));
    if ((courseIds as number[]).length) {
      await db.insert(bundleCoursesTable).values(
        (courseIds as number[]).map(cId => ({ bundleId: id, courseId: cId }))
      );
    }
  }
  const result = await getBundleWithCourses(id);
  res.json(result);
});

router.delete("/admin/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(bundlesTable).where(eq(bundlesTable.id, id));
  res.json({ success: true });
});

/* ── Bundle Payment Routes ───────────────────────────────────────────────── */

// ── Legacy auth-only checkout (kept for backward compat) ──────────────────
router.post("/checkout", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const { bundleId, gateway, couponCode, affiliateRef, state, mobile } = req.body;
  if (!bundleId || !gateway) { res.status(400).json({ error: "bundleId and gateway are required" }); return; }

  const bundle = await getBundleWithCourses(bundleId);
  if (!bundle || !bundle.isActive) { res.status(404).json({ error: "Bundle not found" }); return; }

  const [user] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, authedReq.user.userId)).limit(1);

  let amount = bundle.price;

  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode.toUpperCase())).limit(1);
    if (coupon && coupon.isActive && (!coupon.expiresAt || coupon.expiresAt > new Date()) && (!coupon.maxUses || coupon.usedCount < coupon.maxUses) && !coupon.courseId) {
      const discount = parseFloat(String(coupon.discountValue));
      if (coupon.discountType === "percentage") amount = amount * (1 - discount / 100);
      else amount = Math.max(0, amount - discount);
    }
  }

  const sessionId = nanoid(32);
  await db.insert(paymentsTable).values({
    userId: authedReq.user.userId,
    bundleId,
    courseId: null,
    amount: String(amount.toFixed(2)),
    currency: "INR",
    status: "pending",
    gateway,
    sessionId,
    couponCode: couponCode || null,
    affiliateRef: affiliateRef || null,
    billingName: user?.name || null,
    billingEmail: user?.email || null,
    billingMobile: mobile?.trim() || null,
    billingState: state || null,
  });

  res.json({ sessionId, amount, currency: "INR", gateway });
});

router.post("/verify", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const { sessionId } = req.body;
  if (!sessionId) { res.status(400).json({ error: "sessionId is required" }); return; }

  const [payment] = await db.select().from(paymentsTable).where(
    and(eq(paymentsTable.sessionId, sessionId), eq(paymentsTable.userId, authedReq.user.userId))
  ).limit(1);
  if (!payment) { res.status(404).json({ error: "Payment session not found" }); return; }
  if (!payment.bundleId) { res.status(400).json({ error: "Not a bundle payment" }); return; }

  await db.update(paymentsTable).set({ status: "completed", paymentId: `sim_${nanoid(12)}` }).where(eq(paymentsTable.id, payment.id));

  if (payment.couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, payment.couponCode)).limit(1);
    if (coupon) await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
  }

  const { enrolledCourses, bundleName } = await enrollInBundle(payment.bundleId, authedReq.user.userId, payment.affiliateRef);
  res.json({ success: true, bundleId: payment.bundleId, enrolledCourses, bundleName });
});

// ── Guest / Auto-register Bundle Checkout (simulated gateways) ───────────
router.post("/checkout/guest", async (req, res): Promise<void> => {
  const { bundleId, email, fullName, state, mobile, gateway, couponCode, affiliateRef } = req.body;
  if (!bundleId || !email || !fullName || !gateway) {
    res.status(400).json({ error: "bundleId, email, fullName, and gateway are required" }); return;
  }

  const bundle = await getBundleWithCourses(parseInt(bundleId));
  if (!bundle || !bundle.isActive) { res.status(404).json({ error: "Bundle not found" }); return; }

  // Find or create user
  let userId: number;
  let isNewUser = false;
  let tempPassword: string | undefined;

  const existingToken = req.cookies?.token;
  if (existingToken) {
    try { const payload = verifyToken(existingToken); userId = payload.userId; }
    catch { userId = 0; }
  } else { userId = 0; }

  if (!userId) {
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      tempPassword = nanoid(10);
      const hashed = await bcrypt.hash(tempPassword, 10);
      const [newUser] = await db.insert(usersTable).values({
        email: email.toLowerCase().trim(), password: hashed, name: fullName.trim(),
        referralCode: nanoid(8).toUpperCase(), role: "student",
      }).returning();
      userId = newUser.id;
      isNewUser = true;
    }
  }

  // Apply coupon (bundle-wide only — no courseId restriction)
  let amount = bundle.price;
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode.toUpperCase())).limit(1);
    if (coupon && coupon.isActive && (!coupon.expiresAt || coupon.expiresAt > new Date()) && (!coupon.maxUses || coupon.usedCount < coupon.maxUses) && !coupon.courseId) {
      const discount = parseFloat(String(coupon.discountValue));
      amount = coupon.discountType === "percentage" ? amount * (1 - discount / 100) : Math.max(0, amount - discount);
      await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
    }
  }

  // Insert completed payment
  const sessionId = nanoid(32);
  await db.insert(paymentsTable).values({
    userId,
    bundleId: bundle.id,
    courseId: null,
    amount: String(amount.toFixed(2)),
    currency: "INR",
    status: "completed",
    gateway,
    sessionId,
    paymentId: `sim_${nanoid(12)}`,
    couponCode: couponCode || null,
    affiliateRef: affiliateRef || null,
    billingName: fullName?.trim() || null,
    billingEmail: email?.toLowerCase().trim() || null,
    billingMobile: mobile?.trim() || null,
    billingState: state || null,
  });

  // Enroll in all bundle courses
  const { enrolledCourses, bundleName } = await enrollInBundle(bundle.id, userId, affiliateRef);

  // Auto-login
  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (freshUser) {
    if (isNewUser) triggerAutomation("welcome", freshUser.id, freshUser.email, { name: freshUser.name, email: freshUser.email }).catch(() => {});
  }
  const token = signToken({ userId: freshUser!.id, email: freshUser!.email, role: freshUser!.role });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });

  const { password: _, ...safeUser } = freshUser!;
  res.json({
    success: true, isNewUser, tempPassword,
    user: safeUser,
    bundleId: bundle.id, bundleName,
    enrolledCourses,
    enrolledCount: enrolledCourses.length,
  });
});

// ── Cashfree: Create Order for Bundle ─────────────────────────────────────
router.post("/cashfree/create-order", async (req, res): Promise<void> => {
  const { bundleId, email, fullName, state, mobile, couponCode, affiliateRef } = req.body;
  if (!bundleId || !email || !fullName) {
    res.status(400).json({ error: "bundleId, email, and fullName are required" }); return;
  }

  const [gw] = await db.select().from(paymentGatewaysTable).where(
    and(eq(paymentGatewaysTable.name, "cashfree"), eq(paymentGatewaysTable.isActive, true))
  ).limit(1);
  if (!gw?.apiKey || !gw?.secretKey) {
    res.status(400).json({ error: "Cashfree is not configured or inactive" }); return;
  }

  const bundle = await getBundleWithCourses(parseInt(bundleId));
  if (!bundle || !bundle.isActive) { res.status(404).json({ error: "Bundle not found" }); return; }

  // Find or create user
  let userId: number;
  let isNewUser = false;
  let tempPassword: string | undefined;

  const existingToken = req.cookies?.token;
  if (existingToken) {
    try { const payload = verifyToken(existingToken); userId = payload.userId; }
    catch { userId = 0; }
  } else { userId = 0; }

  if (!userId) {
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      tempPassword = nanoid(10);
      const hashed = await bcrypt.hash(tempPassword, 10);
      const [newUser] = await db.insert(usersTable).values({
        email: email.toLowerCase().trim(), password: hashed, name: fullName.trim(),
        referralCode: nanoid(8).toUpperCase(), role: "student",
      }).returning();
      userId = newUser.id;
      isNewUser = true;
    }
  }

  // Apply coupon
  let amount = bundle.price;
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode.toUpperCase())).limit(1);
    if (coupon?.isActive && (!coupon.maxUses || coupon.usedCount < coupon.maxUses) && !coupon.courseId) {
      const d = parseFloat(String(coupon.discountValue));
      amount = coupon.discountType === "percentage" ? amount * (1 - d / 100) : Math.max(0, amount - d);
    }
  }

  // Insert payment record first to get the auto-incremented DB id
  const sessionId = nanoid(32);
  const host = gw.isTestMode ? "https://sandbox.cashfree.com" : "https://api.cashfree.com";
  const [pendingPayment] = await db.insert(paymentsTable).values({
    userId,
    bundleId: bundle.id,
    courseId: null,
    amount: String(amount.toFixed(2)),
    currency: "INR",
    status: "pending",
    gateway: "cashfree",
    sessionId,
    gatewayOrderId: sessionId, // temp placeholder
    couponCode: couponCode || null,
    affiliateRef: affiliateRef || null,
    billingName: fullName?.trim() || null,
    billingEmail: email?.toLowerCase().trim() || null,
    billingMobile: mobile?.trim() || null,
    billingState: state || null,
  }).returning();

  // Build the Cashfree order ID from the DB payment id so they match
  const cfOrderId = `ORD${pendingPayment.id}`;

  let cfResp: { order_id?: string; payment_session_id?: string; message?: string };
  try {
    const r = await fetch(`${host}/pg/orders`, {
      method: "POST",
      headers: { "x-api-version": "2023-08-01", "x-client-id": gw.apiKey, "x-client-secret": gw.secretKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: cfOrderId,
        order_amount: parseFloat(amount.toFixed(2)),
        order_currency: "INR",
        customer_details: {
          customer_id: `uid_${userId}`,
          customer_email: email.toLowerCase().trim(),
          customer_phone: mobile?.trim() || "9999999999",
          customer_name: fullName.trim(),
        },
        order_meta: { notify_url: "" },
      }),
    });
    cfResp = await r.json();
    if (!r.ok || !cfResp.payment_session_id) {
      await db.delete(paymentsTable).where(eq(paymentsTable.id, pendingPayment.id));
      res.status(400).json({ error: cfResp.message ?? "Failed to create Cashfree order" }); return;
    }
  } catch (err: unknown) {
    await db.delete(paymentsTable).where(eq(paymentsTable.id, pendingPayment.id));
    res.status(500).json({ error: (err as Error).message }); return;
  }

  // Update the payment record with the real gatewayOrderId
  await db.update(paymentsTable).set({ gatewayOrderId: cfOrderId }).where(eq(paymentsTable.id, pendingPayment.id));

  // Auto-login
  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const token = signToken({ userId: freshUser!.id, email: freshUser!.email, role: freshUser!.role });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.json({
    paymentSessionId: cfResp.payment_session_id,
    orderId: cfOrderId,
    isTestMode: gw.isTestMode,
    isNewUser, tempPassword,
    userId,
    bundleId: bundle.id,
    bundleName: bundle.name,
  });
});

// ── Paytm: Create Order for Bundle ───────────────────────────────────────
router.post("/paytm/create-order", async (req, res): Promise<void> => {
  const { bundleId, email, fullName, state, mobile, couponCode, affiliateRef } = req.body;
  if (!bundleId || !email || !fullName) {
    res.status(400).json({ error: "bundleId, email, and fullName are required" }); return;
  }

  const [gw] = await db.select().from(paymentGatewaysTable).where(
    and(eq(paymentGatewaysTable.name, "paytm"), eq(paymentGatewaysTable.isActive, true))
  ).limit(1);
  if (!gw?.apiKey || !gw?.secretKey) {
    res.status(400).json({ error: "Paytm is not configured or inactive" }); return;
  }

  const mid = gw.apiKey;
  const merchantKey = gw.secretKey;

  const bundle = await getBundleWithCourses(parseInt(bundleId));
  if (!bundle || !bundle.isActive) { res.status(404).json({ error: "Bundle not found" }); return; }

  // Find or create user
  let userId: number;
  let isNewUser = false;
  let tempPassword: string | undefined;

  const existingToken = req.cookies?.token;
  if (existingToken) {
    try { const payload = verifyToken(existingToken); userId = payload.userId; }
    catch { userId = 0; }
  } else { userId = 0; }

  if (!userId) {
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      tempPassword = nanoid(10);
      const hashed = await bcrypt.hash(tempPassword, 10);
      const [newUser] = await db.insert(usersTable).values({
        email: email.toLowerCase().trim(), password: hashed, name: fullName.trim(),
        referralCode: nanoid(8).toUpperCase(), role: "student",
      }).returning();
      userId = newUser.id;
      isNewUser = true;
    }
  }

  // Apply coupon
  let amount = bundle.price;
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode.toUpperCase())).limit(1);
    if (coupon?.isActive && (!coupon.maxUses || coupon.usedCount < coupon.maxUses) && !coupon.courseId) {
      const d = parseFloat(String(coupon.discountValue));
      amount = coupon.discountType === "percentage" ? amount * (1 - d / 100) : Math.max(0, amount - d);
    }
  }

  const orderId = `BPT_${nanoid(14)}`;
  const host = gw.isTestMode ? "https://securegw-stage.paytm.in" : "https://securegw.paytm.in";

  const forwardedProto = req.get("x-forwarded-proto") || req.protocol;
  const origin = `${forwardedProto}://${req.get("host")}`;
  const websiteName = gw.isTestMode ? "WEBSTAGING" : (gw.webhookSecret?.startsWith("WS:") ? gw.webhookSecret.slice(3) : "DEFAULT");
  const txnBody: Record<string, unknown> = {
    requestType: "Payment",
    mid,
    websiteName,
    orderId,
    callbackUrl: `${origin}/api/payments/paytm/callback`,
    txnAmount: { value: amount.toFixed(2), currency: "INR" },
    userInfo: { custId: `uid_${userId}` },
  };

  const signature = await PaytmChecksum.generateSignature(JSON.stringify(txnBody), merchantKey);

  let txnToken: string;
  try {
    const reqPayload = { head: { version: "v1", signature }, body: txnBody };
    const r = await fetch(
      `${host}/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(mid)}&orderId=${encodeURIComponent(orderId)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reqPayload) }
    );
    const paytmResp = await r.json();
    if (paytmResp.body?.resultInfo?.resultStatus !== "S") {
      res.status(400).json({ error: paytmResp.body?.resultInfo?.resultMsg ?? "Failed to initiate Paytm transaction" }); return;
    }
    txnToken = paytmResp.body.txnToken;
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message }); return;
  }

  // Store pending payment
  const sessionId = nanoid(32);
  await db.insert(paymentsTable).values({
    userId,
    bundleId: bundle.id,
    courseId: null,
    amount: String(amount.toFixed(2)),
    currency: "INR",
    status: "pending",
    gateway: "paytm",
    sessionId,
    gatewayOrderId: orderId,
    couponCode: couponCode || null,
    affiliateRef: affiliateRef || null,
    billingName: fullName?.trim() || null,
    billingEmail: email?.toLowerCase().trim() || null,
    billingMobile: mobile?.trim() || null,
    billingState: state || null,
  });

  // Auto-login
  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const token = signToken({ userId: freshUser!.id, email: freshUser!.email, role: freshUser!.role });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.json({
    txnToken, orderId, mid,
    amount: parseFloat(amount.toFixed(2)),
    isTestMode: gw.isTestMode,
    isNewUser, tempPassword,
    userId,
    bundleId: bundle.id,
    bundleName: bundle.name,
  });
});

// ── Stripe: Create Order for Bundle ──────────────────────────────────────────
router.post("/stripe/create-order", async (req, res): Promise<void> => {
  const { bundleId, email, fullName, state, mobile, couponCode, affiliateRef } = req.body;
  if (!bundleId || !email || !fullName) {
    res.status(400).json({ error: "bundleId, email, and fullName are required" }); return;
  }

  const [gw] = await db.select().from(paymentGatewaysTable).where(
    and(eq(paymentGatewaysTable.name, "stripe"), eq(paymentGatewaysTable.isActive, true))
  ).limit(1);
  if (!gw?.apiKey || !gw?.secretKey) {
    res.status(400).json({ error: "Stripe is not configured or inactive" }); return;
  }

  const bundle = await getBundleWithCourses(parseInt(bundleId));
  if (!bundle || !bundle.isActive) { res.status(404).json({ error: "Bundle not found" }); return; }

  let userId: number;
  let isNewUser = false;
  let tempPassword: string | undefined;

  const existingToken = req.cookies?.token;
  if (existingToken) {
    try { const payload = verifyToken(existingToken); userId = payload.userId; }
    catch { userId = 0; }
  } else { userId = 0; }

  if (!userId) {
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      tempPassword = nanoid(10);
      const hashed = await bcrypt.hash(tempPassword, 10);
      const [newUser] = await db.insert(usersTable).values({
        email: email.toLowerCase().trim(), password: hashed, name: fullName.trim(),
        referralCode: nanoid(8).toUpperCase(), role: "student",
      }).returning();
      userId = newUser.id;
      isNewUser = true;
    }
  }

  let amount = bundle.price;
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode.toUpperCase())).limit(1);
    if (coupon?.isActive && (!coupon.maxUses || coupon.usedCount < coupon.maxUses) && !coupon.courseId) {
      const d = parseFloat(String(coupon.discountValue));
      amount = coupon.discountType === "percentage" ? amount * (1 - d / 100) : Math.max(0, amount - d);
    }
  }

  const amountInPaise = Math.round(amount * 100);

  try {
    const body = new URLSearchParams({
      amount: String(amountInPaise),
      currency: "inr",
      "payment_method_types[]": "card",
      description: bundle.name,
      "metadata[bundle_id]": String(bundle.id),
      "metadata[bundle_name]": bundle.name,
      "metadata[customer_email]": email.toLowerCase().trim(),
      "metadata[customer_name]": fullName.trim(),
    });
    const r = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: { Authorization: `Bearer ${gw.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const intent = await r.json() as { client_secret: string; id: string; error?: { message: string } };
    if (!r.ok) throw new Error(intent.error?.message ?? "Stripe PaymentIntent failed");

    const sessionId = nanoid(32);
    await db.insert(paymentsTable).values({
      userId,
      bundleId: bundle.id,
      courseId: null,
      amount: String(amount.toFixed(2)),
      currency: "INR",
      status: "pending",
      gateway: "stripe",
      sessionId,
      paymentId: intent.id,
      couponCode: couponCode || null,
      affiliateRef: affiliateRef || null,
      billingName: fullName?.trim() || null,
      billingEmail: email?.toLowerCase().trim() || null,
      billingMobile: mobile?.trim() || null,
      billingState: state || null,
    });

    const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const token = signToken({ userId: freshUser!.id, email: freshUser!.email, role: freshUser!.role });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });

    const { password: _p, ...safeUser } = freshUser!;
    res.json({
      clientSecret: intent.client_secret, publishableKey: gw.apiKey,
      sessionId, paymentIntentId: intent.id, amount,
      isNewUser, tempPassword, user: safeUser,
      bundleName: bundle.name, bundleId: bundle.id,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Stripe: Verify Payment for Bundle ────────────────────────────────────────
router.post("/stripe/verify", async (req, res): Promise<void> => {
  const { paymentIntentId, sessionId } = req.body;
  if (!paymentIntentId || !sessionId) {
    res.status(400).json({ error: "paymentIntentId and sessionId are required" }); return;
  }

  const [payment] = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.sessionId, sessionId)).limit(1);
  if (!payment || !payment.bundleId) { res.status(404).json({ error: "Bundle payment session not found" }); return; }

  const [gw] = await db.select().from(paymentGatewaysTable).where(
    and(eq(paymentGatewaysTable.name, "stripe"), eq(paymentGatewaysTable.isActive, true))
  ).limit(1);
  if (!gw) { res.status(400).json({ error: "Stripe gateway not configured" }); return; }

  const r = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
    headers: { Authorization: `Bearer ${gw.secretKey}` },
  });
  const intent = await r.json() as { status: string; error?: { message: string } };
  if (!r.ok) { res.status(400).json({ error: (intent as { error?: { message: string } }).error?.message ?? "Failed to verify Stripe payment" }); return; }

  if (intent.status !== "succeeded") {
    res.status(400).json({ error: `Payment not completed. Stripe status: ${intent.status}` }); return;
  }

  if (payment.status === "completed") {
    const bundle = await getBundleWithCourses(payment.bundleId);
    const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
    const { password: _p2, ...safeUser } = freshUser!;
    res.json({ success: true, alreadyEnrolled: true, bundleId: payment.bundleId, bundleName: bundle?.name, user: safeUser, enrolledCount: bundle?.courses.length ?? 0 });
    return;
  }

  await db.update(paymentsTable).set({ status: "completed", paymentId: paymentIntentId })
    .where(eq(paymentsTable.id, payment.id));

  const { enrolledCourses, bundleName } = await enrollInBundle(payment.bundleId, payment.userId, payment.affiliateRef);

  if (payment.couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, payment.couponCode)).limit(1);
    if (coupon) await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
  }

  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
  const { password: _p3, ...safeUser } = freshUser!;
  res.json({
    success: true,
    bundleId: payment.bundleId,
    bundleName,
    enrolledCount: enrolledCourses.length,
    user: safeUser,
  });
});

export default router;

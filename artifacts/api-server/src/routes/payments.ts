import { Router } from "express";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  paymentsTable, coursesTable, enrollmentsTable, couponsTable, notificationsTable,
  usersTable, paymentGatewaysTable, referralsTable, affiliateClicksTable,
  affiliateApplicationsTable, platformSettingsTable, affiliatePixelTable,
  commissionGroupsTable,
} from "@workspace/db";
import { eq, and, desc, isNull, or } from "drizzle-orm";
import { bundlesTable, bundleCoursesTable } from "@workspace/db";
import { requireAuth, signToken, verifyToken, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";
import { triggerAutomation, triggerFunnel } from "./crm";
import { sendFbEvent } from "../lib/facebook-pixel";
import { generateGstInvoice } from "./gst";

const router = Router();
type AuthedRequest = Request & { user: JwtPayload };

/* ── Affiliate Commission Helper ─────────────────────────────────────────── */
async function recordAffiliateCommission(
  affiliateRef: string | null | undefined,
  buyerId: number,
  courseId: number | null,
  saleAmount: number,
): Promise<void> {
  if (!affiliateRef) {
    console.info("[affiliate commission] skipped — no affiliateRef");
    return;
  }
  const purchaseType = courseId != null ? `course(${courseId})` : "bundle";
  console.info(`[affiliate commission] start | ref=${affiliateRef} buyer=${buyerId} type=${purchaseType} amount=${saleAmount}`);
  try {
    // Find referrer (include role, name, email for eligibility check + automation triggers)
    const [referrer] = await db.select({ id: usersTable.id, role: usersTable.role, name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.referralCode, affiliateRef)).limit(1);
    if (!referrer) {
      console.warn(`[affiliate commission] referrer not found for code=${affiliateRef}`);
      return;
    }

    // Prevent self-referral
    if (referrer.id === buyerId) {
      console.info(`[affiliate commission] self-referral skipped referrerId=${referrer.id}`);
      return;
    }

    // Get commission rate: check application for commission override; admins/affiliates both eligible
    const [settings] = await db.select({ commissionRate: platformSettingsTable.commissionRate }).from(platformSettingsTable).limit(1);
    const defaultRate = settings?.commissionRate ?? 20;

    let rate = defaultRate;

    if (referrer.role === "affiliate") {
      // Affiliates must have an approved, non-blocked application
      const [app] = await db.select({
        commissionOverride: affiliateApplicationsTable.commissionOverride,
        commissionGroupId: affiliateApplicationsTable.commissionGroupId,
        isBlocked: affiliateApplicationsTable.isBlocked,
      })
        .from(affiliateApplicationsTable)
        .where(and(eq(affiliateApplicationsTable.userId, referrer.id), eq(affiliateApplicationsTable.status, "approved")))
        .limit(1);
      if (!app) {
        console.warn(`[affiliate commission] affiliate referrerId=${referrer.id} has no approved application — skipping`);
        return;
      }
      if (app.isBlocked) {
        console.warn(`[affiliate commission] affiliate referrerId=${referrer.id} is blocked — skipping`);
        return;
      }
      if (app.commissionOverride != null) {
        rate = app.commissionOverride; // Individual override takes highest priority
      } else if (app.commissionGroupId != null) {
        const [grp] = await db.select({ commissionRate: commissionGroupsTable.commissionRate })
          .from(commissionGroupsTable).where(eq(commissionGroupsTable.id, app.commissionGroupId)).limit(1);
        if (grp) rate = grp.commissionRate; // Group rate second priority
      }
    } else if (referrer.role === "admin") {
      // Admins can always earn commission — use platform default (no block check)
      const [app] = await db.select({
        commissionOverride: affiliateApplicationsTable.commissionOverride,
        commissionGroupId: affiliateApplicationsTable.commissionGroupId,
      })
        .from(affiliateApplicationsTable)
        .where(eq(affiliateApplicationsTable.userId, referrer.id))
        .limit(1);
      if (app?.commissionOverride != null) {
        rate = app.commissionOverride;
      } else if (app?.commissionGroupId != null) {
        const [grp] = await db.select({ commissionRate: commissionGroupsTable.commissionRate })
          .from(commissionGroupsTable).where(eq(commissionGroupsTable.id, app.commissionGroupId)).limit(1);
        if (grp) rate = grp.commissionRate;
      }
    } else {
      // Students and other roles cannot earn commission without an application
      console.warn(`[affiliate commission] referrerId=${referrer.id} role=${referrer.role} is ineligible — skipping`);
      return;
    }

    const commission = parseFloat(((saleAmount * rate) / 100).toFixed(2));
    console.info(`[affiliate commission] rate=${rate}% commission=₹${commission} referrerId=${referrer.id}`);

    // Find the most recent click referral for this referrer+course that isn't yet a purchase.
    // First try exact courseId match; if not found, fall back to a generic click (courseId IS NULL)
    // which is what gets created when someone clicks a bare affiliate link (no specific course).
    const [clickRef] = await db.select()
      .from(referralsTable)
      .where(and(
        eq(referralsTable.referrerId, referrer.id),
        courseId != null ? eq(referralsTable.courseId, courseId) : isNull(referralsTable.courseId),
        isNull(referralsTable.referredUserId),
        eq(referralsTable.status, "click"),
      ))
      .orderBy(desc(referralsTable.createdAt))
      .limit(1);

    // If no exact-course click, look for ANY generic (courseId=null) click referral to upgrade
    const [genericClickRef] = clickRef ? [null] : await db.select()
      .from(referralsTable)
      .where(and(
        eq(referralsTable.referrerId, referrer.id),
        isNull(referralsTable.courseId),
        isNull(referralsTable.referredUserId),
        eq(referralsTable.status, "click"),
      ))
      .orderBy(desc(referralsTable.createdAt))
      .limit(1);

    const refToUpgrade = clickRef ?? genericClickRef;

    if (refToUpgrade) {
      console.info(`[affiliate commission] upgrading click referral id=${refToUpgrade.id} → purchase`);
      await db.update(referralsTable)
        .set({ status: "purchase", referredUserId: buyerId, courseId: courseId ?? refToUpgrade.courseId, commission: String(commission) })
        .where(eq(referralsTable.id, refToUpgrade.id));
    } else {
      console.info(`[affiliate commission] no click referral found — inserting new purchase referral`);
      await db.insert(referralsTable).values({
        referrerId: referrer.id, referredUserId: buyerId, courseId, status: "purchase", commission: String(commission),
      });
    }

    // Mark affiliate click as converted (use IS NULL for courseId to avoid SQL = NULL bug)
    await db.update(affiliateClicksTable)
      .set({ convertedAt: new Date() })
      .where(and(
        eq(affiliateClicksTable.affiliateId, referrer.id),
        courseId != null
          ? or(eq(affiliateClicksTable.courseId, courseId), isNull(affiliateClicksTable.courseId))
          : isNull(affiliateClicksTable.courseId),
        isNull(affiliateClicksTable.convertedAt),
      ));

    // Notify the affiliate — context-aware message for course vs bundle
    const purchaseLabel = courseId != null ? "a course purchase" : "a bundle/package purchase";
    await db.insert(notificationsTable).values({
      userId: referrer.id,
      title: "Commission Earned! 🎉",
      message: `You earned ₹${commission.toFixed(2)} commission from ${purchaseLabel}.`,
      type: "success",
    });

    // Fire CRM automation + funnel for affiliate_commission event (non-blocking)
    const commissionVars = {
      name: referrer.name,
      commission_amount: commission.toFixed(2),
      payout_amount: commission.toFixed(2),
      site_url: process.env.SITE_URL || "",
    };
    triggerAutomation("affiliate_commission", referrer.id, referrer.email, commissionVars).catch(e => console.error("[affiliate commission] triggerAutomation error:", e));
    triggerFunnel("affiliate_commission", referrer.id, commissionVars).catch(e => console.error("[affiliate commission] triggerFunnel error:", e));

    console.info(`[affiliate commission] done — commission=₹${commission} referrerId=${referrer.id} type=${purchaseType}`);

    // Fire FB Purchase event (non-blocking) — value = affiliate commission
    const [pixel] = await db.select({ facebookPixelId: affiliatePixelTable.facebookPixelId, accessToken: affiliatePixelTable.accessToken })
      .from(affiliatePixelTable).where(eq(affiliatePixelTable.userId, referrer.id)).limit(1);
    if (pixel?.facebookPixelId && pixel?.accessToken) {
      sendFbEvent(pixel.facebookPixelId, pixel.accessToken, {
        eventName: "Purchase",
        value: commission,
        currency: "INR",
      }).catch(e => console.error("[fb pixel Purchase]", e));
    }
  } catch (err) { console.error("[affiliate commission] ERROR:", err); }
}

router.post("/checkout", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const { courseId, couponCode, gateway, affiliateRef, state, mobile } = req.body;
  if (!courseId || !gateway) { res.status(400).json({ error: "courseId and gateway are required" }); return; }

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }

  const [user] = await db.select({ name: usersTable.name, email: usersTable.email, phone: usersTable.phone }).from(usersTable).where(eq(usersTable.id, authedReq.user.userId)).limit(1);

  let amount = parseFloat(course.price);

  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode.toUpperCase())).limit(1);
    if (coupon && coupon.isActive && (!coupon.expiresAt || coupon.expiresAt > new Date()) && (!coupon.maxUses || coupon.usedCount < coupon.maxUses)) {
      if (!coupon.courseId || coupon.courseId === courseId) {
        const discount = parseFloat(String(coupon.discountValue));
        if (coupon.discountType === "percentage") amount = amount * (1 - discount / 100);
        else amount = Math.max(0, amount - discount);
      }
    }
  }

  const sessionId = nanoid(32);
  await db.insert(paymentsTable).values({
    userId: authedReq.user.userId,
    courseId,
    amount: String(amount.toFixed(2)),
    currency: "INR",
    status: "pending",
    gateway,
    sessionId,
    couponCode: couponCode || null,
    affiliateRef: affiliateRef || null,
    billingName: user?.name || null,
    billingEmail: user?.email || null,
    billingMobile: mobile?.trim() || user?.phone || null,
    billingState: state || null,
  });

  res.json({ sessionId, amount, currency: "INR", gateway, redirectUrl: null, razorpayOrderId: null, razorpayKey: null });
});

router.post("/verify", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const { sessionId } = req.body;
  if (!sessionId) { res.status(400).json({ error: "sessionId is required" }); return; }

  const [payment] = await db.select().from(paymentsTable).where(and(eq(paymentsTable.sessionId, sessionId), eq(paymentsTable.userId, authedReq.user.userId))).limit(1);
  if (!payment) { res.status(404).json({ error: "Payment session not found" }); return; }

  await db.update(paymentsTable).set({ status: "completed", paymentId: `sim_${nanoid(12)}` }).where(eq(paymentsTable.id, payment.id));
  generateGstInvoice(payment.id).catch(() => {});

  const existing = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, authedReq.user.userId), eq(enrollmentsTable.courseId, payment.courseId))).limit(1);
  let enrollmentId: number | null = null;
  if (existing.length === 0) {
    const [enrollment] = await db.insert(enrollmentsTable).values({ userId: authedReq.user.userId, courseId: payment.courseId }).returning();
    enrollmentId = enrollment.id;
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
    await db.insert(notificationsTable).values({ userId: authedReq.user.userId, title: "Enrollment Confirmed!", message: `You are now enrolled in ${course?.title ?? "the course"}`, type: "success" });
    const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, authedReq.user.userId)).limit(1);
    if (buyer) {
      triggerAutomation("purchase", buyer.id, buyer.email, { name: buyer.name, email: buyer.email, course_name: course?.title ?? "", amount: String(parseFloat(String(payment.amount)).toFixed(2)) }).catch(() => {});
      triggerFunnel("new_purchase", buyer.id, { course_name: course?.title ?? "", amount: String(parseFloat(String(payment.amount)).toFixed(2)), site_url: process.env.SITE_URL || "" }).catch(() => {});
    }
    await recordAffiliateCommission(payment.affiliateRef, authedReq.user.userId, payment.courseId, parseFloat(String(payment.amount)));
  } else {
    enrollmentId = existing[0].id;
  }

  if (payment.couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, payment.couponCode)).limit(1);
    if (coupon) await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
  }

  res.json({ success: true, enrollmentId, message: "Payment verified and enrolled" });
});

router.get("/history", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.userId, authedReq.user.userId)).orderBy(paymentsTable.createdAt);
  const enriched = await Promise.all(payments.map(async (p) => {
    if (p.bundleId) {
      const [bundle] = await db.select().from(bundlesTable).where(eq(bundlesTable.id, p.bundleId)).limit(1);
      return { ...p, amount: parseFloat(String(p.amount)), course: null, bundle: bundle ? { id: bundle.id, name: bundle.name, thumbnailUrl: bundle.thumbnailUrl } : null };
    }
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, p.courseId)).limit(1);
    return { ...p, amount: parseFloat(String(p.amount)), bundle: null, course: course ? { ...course, price: parseFloat(course.price), moduleCount: 0, lessonCount: 0, enrollmentCount: 0 } : null };
  }));
  res.json(enriched);
});

router.get("/my-bundles", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const userId = authedReq.user.userId;

  // Only consider completed (non-refunded) bundle payments
  const bundlePayments = await db
    .select()
    .from(paymentsTable)
    .where(and(eq(paymentsTable.userId, userId), eq(paymentsTable.status, "completed")))
    .orderBy(paymentsTable.createdAt);
  const bundleIds = [...new Set(bundlePayments.filter(p => p.bundleId).map(p => p.bundleId!))];

  const result = await Promise.all(bundleIds.map(async (bid) => {
    const [bundle] = await db.select().from(bundlesTable).where(eq(bundlesTable.id, bid)).limit(1);
    if (!bundle) return null;

    const bundleCourseRows = await db
      .select({
        id: coursesTable.id, title: coursesTable.title, description: coursesTable.description,
        thumbnailUrl: coursesTable.thumbnailUrl, price: coursesTable.price,
        category: coursesTable.category, level: coursesTable.level, durationMinutes: coursesTable.durationMinutes,
      })
      .from(bundleCoursesTable)
      .leftJoin(coursesTable, eq(bundleCoursesTable.courseId, coursesTable.id))
      .where(eq(bundleCoursesTable.bundleId, bid));

    const validCourses = bundleCourseRows.filter(c => c.id !== null);

    // Secondary guard: verify the user still has at least one active enrollment
    // in the bundle's courses. This ensures refunded bundles (where enrollments
    // are deleted) are hidden even if the payment status check somehow passes.
    if (validCourses.length > 0) {
      const courseIds = validCourses.map(c => c.id!);
      const [anyEnrollment] = await db
        .select({ id: enrollmentsTable.id })
        .from(enrollmentsTable)
        .where(and(
          eq(enrollmentsTable.userId, userId),
          courseIds.length === 1
            ? eq(enrollmentsTable.courseId, courseIds[0])
            : or(...courseIds.map(cid => eq(enrollmentsTable.courseId, cid)))
        ))
        .limit(1);
      if (!anyEnrollment) return null; // Refunded / access revoked
    }

    const payment = bundlePayments.find(p => p.bundleId === bid);
    return {
      ...bundle,
      price: parseFloat(String(bundle.price)),
      compareAtPrice: bundle.compareAtPrice ? parseFloat(String(bundle.compareAtPrice)) : null,
      purchasedAt: payment?.createdAt,
      amount: payment ? parseFloat(String(payment.amount)) : null,
      courses: validCourses.map(c => ({ ...c, price: parseFloat(String(c.price)) })),
    };
  }));
  res.json(result.filter(Boolean));
});

// ── Guest / Auto-register Checkout ───────────────────────────────────────────
router.post("/checkout/guest", async (req, res): Promise<void> => {
  const { courseId, email, fullName, state, mobile, gateway, couponCode, affiliateRef } = req.body;
  if (!courseId || !email || !fullName || !gateway) {
    res.status(400).json({ error: "courseId, email, fullName, and gateway are required" }); return;
  }

  // Determine user (logged-in or find/create by email)
  let userId: number;
  let isNewUser = false;
  let tempPassword: string | undefined;

  const existingToken = req.cookies?.token;
  if (existingToken) {
    try {
      const payload = verifyToken(existingToken);
      userId = payload.userId;
    } catch {
      userId = 0;
    }
  } else {
    userId = 0;
  }

  if (!userId) {
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Auto-create account
      tempPassword = nanoid(10);
      const hashed = await bcrypt.hash(tempPassword, 10);
      const referralCode = nanoid(8).toUpperCase();
      const [newUser] = await db.insert(usersTable).values({
        email: email.toLowerCase().trim(),
        password: hashed,
        name: fullName.trim(),
        referralCode,
        role: "student",
      }).returning();
      userId = newUser.id;
      isNewUser = true;
    }
  }

  // Coupon
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, parseInt(courseId))).limit(1);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }

  let amount = parseFloat(course.price);
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode.toUpperCase())).limit(1);
    if (coupon && coupon.isActive && (!coupon.expiresAt || coupon.expiresAt > new Date()) && (!coupon.maxUses || coupon.usedCount < coupon.maxUses)) {
      if (!coupon.courseId || coupon.courseId === parseInt(courseId)) {
        const discount = parseFloat(String(coupon.discountValue));
        amount = coupon.discountType === "percentage" ? amount * (1 - discount / 100) : Math.max(0, amount - discount);
        await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
      }
    }
  }

  // Payment + Enrollment
  const sessionId = nanoid(32);
  const [newPayment] = await db.insert(paymentsTable).values({
    userId, courseId: parseInt(courseId),
    amount: String(amount.toFixed(2)), currency: "INR",
    status: "completed", gateway,
    sessionId, paymentId: `sim_${nanoid(12)}`,
    couponCode: couponCode || null,
    affiliateRef: affiliateRef || null,
    billingName: fullName?.trim() || null,
    billingEmail: email?.toLowerCase().trim() || null,
    billingMobile: mobile?.trim() || null,
    billingState: state || null,
  }).returning({ id: paymentsTable.id });
  if (newPayment) generateGstInvoice(newPayment.id).catch(() => {});

  const [existing] = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, userId), eq(enrollmentsTable.courseId, parseInt(courseId)))).limit(1);
  if (!existing) {
    await db.insert(enrollmentsTable).values({ userId, courseId: parseInt(courseId) });
    await db.insert(notificationsTable).values({ userId, title: "Enrollment Confirmed!", message: `You are now enrolled in ${course.title}`, type: "success" });
    await recordAffiliateCommission(affiliateRef, userId, parseInt(courseId), amount);
  }

  // Auto-login: set JWT cookie
  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (freshUser) {
    if (isNewUser) triggerAutomation("welcome", freshUser.id, freshUser.email, { name: freshUser.name, email: freshUser.email }).catch(() => {});
    if (!existing) {
      triggerAutomation("purchase", freshUser.id, freshUser.email, { name: freshUser.name, email: freshUser.email, course_name: course.title, amount: String(amount.toFixed(2)) }).catch(() => {});
      triggerFunnel("new_purchase", freshUser.id, { course_name: course.title, amount: String(amount.toFixed(2)), site_url: process.env.SITE_URL || "" }).catch(() => {});
    }
  }
  const token = signToken({ userId: freshUser!.id, email: freshUser!.email, role: freshUser!.role });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });

  const { password: _, ...safeUser } = freshUser!;
  res.json({ success: true, isNewUser, tempPassword, user: safeUser, courseId: parseInt(courseId), courseTitle: course.title });
});

// ── Cashfree: Create Order + Pre-register User ───────────────────────────────
router.post("/cashfree/create-order", async (req, res): Promise<void> => {
  const { courseId, email, fullName, state, mobile, couponCode, affiliateRef } = req.body;
  if (!courseId || !email || !fullName) {
    res.status(400).json({ error: "courseId, email, and fullName are required" }); return;
  }

  // Find the Cashfree gateway config
  const [gw] = await db.select().from(paymentGatewaysTable).where(
    and(eq(paymentGatewaysTable.name, "cashfree"), eq(paymentGatewaysTable.isActive, true))
  ).limit(1);
  if (!gw?.apiKey || !gw?.secretKey) {
    res.status(400).json({ error: "Cashfree is not configured or inactive" }); return;
  }

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
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, parseInt(courseId))).limit(1);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }

  let amount = parseFloat(course.price);
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode.toUpperCase())).limit(1);
    if (coupon?.isActive && (!coupon.maxUses || coupon.usedCount < coupon.maxUses)) {
      const d = parseFloat(String(coupon.discountValue));
      amount = coupon.discountType === "percentage" ? amount * (1 - d / 100) : Math.max(0, amount - d);
    }
  }

  // Insert payment record first to get the auto-incremented DB id
  const sessionId = nanoid(32);
  const host = gw.isTestMode ? "https://sandbox.cashfree.com" : "https://api.cashfree.com";
  const [pendingPayment] = await db.insert(paymentsTable).values({
    userId, courseId: parseInt(courseId),
    amount: String(amount.toFixed(2)), currency: "INR",
    status: "pending", gateway: "cashfree",
    sessionId, gatewayOrderId: sessionId, // temp placeholder
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
    courseId: parseInt(courseId),
    courseTitle: course.title,
  });
});

// ── Cashfree: Verify Payment & Complete Enrollment ────────────────────────────
router.post("/cashfree/verify", async (req, res): Promise<void> => {
  const { orderId } = req.body;
  if (!orderId) { res.status(400).json({ error: "orderId is required" }); return; }

  // Find the pending payment record
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.gatewayOrderId, orderId)).limit(1);
  if (!payment) { res.status(404).json({ error: "Payment record not found" }); return; }
  if (payment.status === "completed") {
    // Payment was already processed (by webhook or previous verify call) — show success
    if (payment.bundleId && !payment.courseId) {
      const [bundle] = await db.select().from(bundlesTable).where(eq(bundlesTable.id, payment.bundleId)).limit(1);
      const bundleCourses = await db.select({ courseId: bundleCoursesTable.courseId }).from(bundleCoursesTable).where(eq(bundleCoursesTable.bundleId, payment.bundleId));
      res.json({ success: true, enrolled: true, bundleId: payment.bundleId, bundleName: bundle?.name, courseCount: bundleCourses.length, amount: parseFloat(String(payment.amount)), currency: "INR" });
    } else {
      const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
      res.json({ success: true, enrolled: true, courseId: payment.courseId, courseTitle: course?.title, amount: parseFloat(String(payment.amount)), currency: "INR" });
    }
    return;
  }

  // Get Cashfree gateway config
  const [gw] = await db.select().from(paymentGatewaysTable).where(eq(paymentGatewaysTable.name, "cashfree")).limit(1);
  if (!gw) { res.status(400).json({ error: "Cashfree not configured" }); return; }

  // Verify with Cashfree API
  const host = gw.isTestMode ? "https://sandbox.cashfree.com" : "https://api.cashfree.com";
  try {
    const r = await fetch(`${host}/pg/orders/${orderId}`, {
      headers: { "x-api-version": "2023-08-01", "x-client-id": gw.apiKey, "x-client-secret": gw.secretKey },
    });
    const order = await r.json();

    const status: string = order.order_status ?? "";
    if (status === "PAID") {
      // Fetch the actual Cashfree transaction ID (cf_payment_id) from the payments list
      let cfTxnId: string = order.cf_order_id ? String(order.cf_order_id) : `cf_${nanoid(12)}`;
      try {
        const pr = await fetch(`${host}/pg/orders/${orderId}/payments`, {
          headers: { "x-api-version": "2023-08-01", "x-client-id": gw.apiKey, "x-client-secret": gw.secretKey },
        });
        const pList = await pr.json();
        const successPay = Array.isArray(pList) ? pList.find((p: { payment_status?: string; cf_payment_id?: number | string }) => p.payment_status === "SUCCESS") ?? pList[0] : null;
        if (successPay?.cf_payment_id) cfTxnId = String(successPay.cf_payment_id);
      } catch { /* fallback to cf_order_id already set */ }
      await db.update(paymentsTable).set({ status: "completed", paymentId: cfTxnId }).where(eq(paymentsTable.id, payment.id));
      generateGstInvoice(payment.id).catch(() => {});

      // Bundle payment
      if (payment.bundleId && !payment.courseId) {
        const [bundle] = await db.select().from(bundlesTable).where(eq(bundlesTable.id, payment.bundleId)).limit(1);
        const bundleCourses = await db.select({ courseId: bundleCoursesTable.courseId }).from(bundleCoursesTable).where(eq(bundleCoursesTable.bundleId, payment.bundleId));
        for (const { courseId } of bundleCourses) {
          if (!courseId) continue;
          const [ex] = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, payment.userId), eq(enrollmentsTable.courseId, courseId))).limit(1);
          if (!ex) await db.insert(enrollmentsTable).values({ userId: payment.userId, courseId });
        }
        await db.insert(notificationsTable).values({ userId: payment.userId, title: "Package Enrolled! 🎉", message: `You now have access to all courses in "${bundle?.name ?? "the package"}".`, type: "success" });
        triggerFunnel("new_purchase", payment.userId, { course_name: bundle?.name ?? "", amount: String(parseFloat(String(payment.amount)).toFixed(2)), site_url: process.env.SITE_URL || "" }).catch(() => {});
        if (payment.couponCode) {
          const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, payment.couponCode)).limit(1);
          if (coupon) await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
        }
        await recordAffiliateCommission(payment.affiliateRef, payment.userId, null, parseFloat(String(payment.amount)));
        res.json({ success: true, enrolled: true, bundleId: payment.bundleId, bundleName: bundle?.name, courseCount: bundleCourses.length, amount: parseFloat(String(payment.amount)), currency: "INR" });
        return;
      }

      // Single course payment
      const [existing] = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, payment.userId), eq(enrollmentsTable.courseId, payment.courseId))).limit(1);
      if (!existing) {
        await db.insert(enrollmentsTable).values({ userId: payment.userId, courseId: payment.courseId });
        const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
        await db.insert(notificationsTable).values({ userId: payment.userId, title: "Enrollment Confirmed!", message: `You are now enrolled in ${course?.title ?? "the course"}`, type: "success" });
        if (payment.couponCode) {
          const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, payment.couponCode)).limit(1);
          if (coupon) await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
        }
        const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
        if (buyer && course) {
          triggerAutomation("purchase", buyer.id, buyer.email, { name: buyer.name, email: buyer.email, course_name: course.title, amount: String(parseFloat(String(payment.amount)).toFixed(2)) }).catch(() => {});
          triggerFunnel("new_purchase", buyer.id, { course_name: course.title, amount: String(parseFloat(String(payment.amount)).toFixed(2)), site_url: process.env.SITE_URL || "" }).catch(() => {});
        }
        await recordAffiliateCommission(payment.affiliateRef, payment.userId, payment.courseId, parseFloat(String(payment.amount)));
      }

      const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
      res.json({ success: true, enrolled: true, courseId: payment.courseId, courseTitle: course?.title, amount: parseFloat(String(payment.amount)), currency: "INR" });
    } else if (status === "ACTIVE") {
      res.json({ success: false, pending: true, status, message: "Payment is pending. Please wait." });
    } else {
      await db.update(paymentsTable).set({ status: "failed" }).where(eq(paymentsTable.id, payment.id));
      res.json({ success: false, failed: true, status, message: `Payment ${status}. Please try again.` });
    }
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Cashfree: Webhook ─────────────────────────────────────────────────────────
router.post("/cashfree/webhook", async (req, res): Promise<void> => {
  // 1. Verify Cashfree webhook signature
  const timestamp = req.headers["x-webhook-timestamp"] as string | undefined;
  const signature = req.headers["x-webhook-signature"] as string | undefined;
  const rawBody = (req as { rawBody?: string }).rawBody ?? "";

  if (timestamp && signature) {
    const [gw] = await db.select().from(paymentGatewaysTable).where(eq(paymentGatewaysTable.name, "cashfree")).limit(1);
    if (gw?.secretKey) {
      const computed = crypto
        .createHmac("sha256", gw.secretKey)
        .update(timestamp + rawBody)
        .digest("base64");
      if (computed !== signature) {
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }
    }
  }

  // 2. Process event
  const event = req.body;

  // Support both v2023-08-01 and v2025-01-01 formats
  const orderId: string | undefined =
    event?.data?.order?.order_id ??   // v2025-01-01
    event?.data?.order?.orderId;       // fallback

  const orderStatus: string | undefined =
    event?.data?.order?.order_status ??
    event?.data?.payment?.payment_status;

  const isPaid = orderStatus === "PAID" || event?.type === "PAYMENT_SUCCESS_WEBHOOK";

  if (!orderId || !isPaid) { res.json({ received: true }); return; }

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.gatewayOrderId, orderId)).limit(1);
  if (!payment || payment.status === "completed") { res.json({ received: true }); return; }

  const cfPaymentId: string = event?.data?.payment?.cf_payment_id
    ? String(event.data.payment.cf_payment_id)
    : `cf_wh_${nanoid(10)}`;

  await db.update(paymentsTable).set({ status: "completed", paymentId: cfPaymentId }).where(eq(paymentsTable.id, payment.id));
  generateGstInvoice(payment.id).catch(() => {});

  if (payment.bundleId && !payment.courseId) {
    const [bundle] = await db.select().from(bundlesTable).where(eq(bundlesTable.id, payment.bundleId)).limit(1);
    const bundleCourses = await db.select({ courseId: bundleCoursesTable.courseId }).from(bundleCoursesTable).where(eq(bundleCoursesTable.bundleId, payment.bundleId));
    for (const { courseId } of bundleCourses) {
      if (!courseId) continue;
      const [ex] = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, payment.userId), eq(enrollmentsTable.courseId, courseId))).limit(1);
      if (!ex) await db.insert(enrollmentsTable).values({ userId: payment.userId, courseId });
    }
    await db.insert(notificationsTable).values({ userId: payment.userId, title: "Package Enrolled! 🎉", message: `You now have access to all courses in "${bundle?.name ?? "the package"}".`, type: "success" });
    triggerFunnel("new_purchase", payment.userId, { course_name: bundle?.name ?? "", amount: String(parseFloat(String(payment.amount)).toFixed(2)), site_url: process.env.SITE_URL || "" }).catch(() => {});
    if (payment.couponCode) {
      const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, payment.couponCode)).limit(1);
      if (coupon) await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
    }
    await recordAffiliateCommission(payment.affiliateRef, payment.userId, null, parseFloat(String(payment.amount)));
  } else {
    const [existing] = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, payment.userId), eq(enrollmentsTable.courseId, payment.courseId))).limit(1);
    if (!existing) {
      await db.insert(enrollmentsTable).values({ userId: payment.userId, courseId: payment.courseId });
      const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
      await db.insert(notificationsTable).values({ userId: payment.userId, title: "Enrollment Confirmed!", message: `You are now enrolled in ${course?.title ?? "the course"}`, type: "success" });
      const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
      if (buyer && course) {
        triggerAutomation("purchase", buyer.id, buyer.email, { name: buyer.name, email: buyer.email, course_name: course.title, amount: String(parseFloat(String(payment.amount)).toFixed(2)) }).catch(() => {});
        triggerFunnel("new_purchase", buyer.id, { course_name: course.title, amount: String(parseFloat(String(payment.amount)).toFixed(2)), site_url: process.env.SITE_URL || "" }).catch(() => {});
      }
      if (payment.couponCode) {
        const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, payment.couponCode)).limit(1);
        if (coupon) await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
      }
      await recordAffiliateCommission(payment.affiliateRef, payment.userId, payment.courseId, parseFloat(String(payment.amount)));
    }
  }
  res.json({ received: true });
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PaytmChecksum = require("paytmchecksum");

// ── Paytm: Create Order + Pre-register User ──────────────────────────────────
router.post("/paytm/create-order", async (req, res): Promise<void> => {
  const { courseId, email, fullName, state, mobile, couponCode, affiliateRef } = req.body;
  if (!courseId || !email || !fullName) {
    res.status(400).json({ error: "courseId, email, and fullName are required" }); return;
  }

  const [gw] = await db.select().from(paymentGatewaysTable).where(
    and(eq(paymentGatewaysTable.name, "paytm"), eq(paymentGatewaysTable.isActive, true))
  ).limit(1);
  if (!gw?.apiKey || !gw?.secretKey) {
    res.status(400).json({ error: "Paytm is not configured or inactive" }); return;
  }

  const mid = gw.apiKey;           // Merchant ID
  const merchantKey = gw.secretKey; // Merchant Key

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
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, parseInt(courseId))).limit(1);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }

  let amount = parseFloat(course.price);
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode.toUpperCase())).limit(1);
    if (coupon?.isActive && (!coupon.maxUses || coupon.usedCount < coupon.maxUses)) {
      const d = parseFloat(String(coupon.discountValue));
      amount = coupon.discountType === "percentage" ? amount * (1 - d / 100) : Math.max(0, amount - d);
    }
  }

  // Build Paytm initiateTransaction request body
  const orderId = `PT_${nanoid(14)}`;
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
    const reqPayload = {
      head: { version: "v1", signature },
      body: txnBody,
    };
    console.log("[paytm create-order] host:", host, "mid:", mid, "orderId:", orderId, "merchantKeyLen:", merchantKey.length, "websiteName:", websiteName, "callbackUrl:", txnBody.callbackUrl);
    const r = await fetch(
      `${host}/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(mid)}&orderId=${encodeURIComponent(orderId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqPayload),
      }
    );
    const paytmResp = await r.json();
    console.log("[paytm create-order] response:", JSON.stringify(paytmResp));
    if (paytmResp.body?.resultInfo?.resultStatus !== "S") {
      res.status(400).json({ error: paytmResp.body?.resultInfo?.resultMsg ?? "Failed to initiate Paytm transaction" }); return;
    }
    txnToken = paytmResp.body.txnToken;
  } catch (err: unknown) {
    console.error("[paytm create-order] error:", err);
    res.status(500).json({ error: (err as Error).message }); return;
  }

  // Store pending payment
  const sessionId = nanoid(32);
  await db.insert(paymentsTable).values({
    userId, courseId: parseInt(courseId),
    amount: String(amount.toFixed(2)), currency: "INR",
    status: "pending", gateway: "paytm",
    sessionId, gatewayOrderId: orderId,
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
    txnToken,
    orderId,
    mid,
    amount: parseFloat(amount.toFixed(2)),
    isTestMode: gw.isTestMode,
    isNewUser,
    tempPassword,
    userId,
    courseId: parseInt(courseId),
    courseTitle: course.title,
  });
});

// ── Paytm: Verify Payment & Complete Enrollment ────────────────────────────────
router.post("/paytm/verify", async (req, res): Promise<void> => {
  const { orderId } = req.body;
  if (!orderId) { res.status(400).json({ error: "orderId is required" }); return; }

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.gatewayOrderId, orderId)).limit(1);
  if (!payment) { res.status(404).json({ error: "Payment record not found" }); return; }
  if (payment.status === "completed") {
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
    res.json({ success: true, enrolled: true, courseId: payment.courseId, courseTitle: course?.title, amount: parseFloat(String(payment.amount)), currency: "INR" });
    return;
  }

  const [gw] = await db.select().from(paymentGatewaysTable).where(eq(paymentGatewaysTable.name, "paytm")).limit(1);
  if (!gw) { res.status(400).json({ error: "Paytm not configured" }); return; }

  const mid = gw.apiKey;
  const merchantKey = gw.secretKey;
  const host = gw.isTestMode ? "https://securegw-stage.paytm.in" : "https://securegw.paytm.in";

  const statusBody = { mid, orderId };
  const statusSignature = await PaytmChecksum.generateSignature(JSON.stringify(statusBody), merchantKey);

  try {
    const r = await fetch(`${host}/v3/order/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        head: { version: "v1", signature: statusSignature },
        body: statusBody,
      }),
    });
    const result = await r.json();
    const resultStatus: string = result.body?.resultInfo?.resultStatus ?? result.body?.status ?? "";

    if (resultStatus === "TXN_SUCCESS") {
      const txnId: string = result.body?.txnId ?? `ptm_${nanoid(12)}`;
      await db.update(paymentsTable).set({ status: "completed", paymentId: txnId }).where(eq(paymentsTable.id, payment.id));
      generateGstInvoice(payment.id).catch(() => {});

      // Bundle payment
      if (payment.bundleId && !payment.courseId) {
        const [bundle] = await db.select().from(bundlesTable).where(eq(bundlesTable.id, payment.bundleId)).limit(1);
        const bundleCourses = await db.select({ courseId: bundleCoursesTable.courseId }).from(bundleCoursesTable).where(eq(bundleCoursesTable.bundleId, payment.bundleId));
        for (const { courseId } of bundleCourses) {
          if (!courseId) continue;
          const [ex] = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, payment.userId), eq(enrollmentsTable.courseId, courseId))).limit(1);
          if (!ex) await db.insert(enrollmentsTable).values({ userId: payment.userId, courseId });
        }
        await db.insert(notificationsTable).values({ userId: payment.userId, title: "Package Enrolled! 🎉", message: `You now have access to all courses in "${bundle?.name ?? "the package"}".`, type: "success" });
        triggerFunnel("new_purchase", payment.userId, { course_name: bundle?.name ?? "", amount: String(parseFloat(String(payment.amount)).toFixed(2)), site_url: process.env.SITE_URL || "" }).catch(() => {});
        if (payment.couponCode) {
          const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, payment.couponCode)).limit(1);
          if (coupon) await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
        }
        await recordAffiliateCommission(payment.affiliateRef, payment.userId, null, parseFloat(String(payment.amount)));
        res.json({ success: true, enrolled: true, bundleId: payment.bundleId, bundleName: bundle?.name, courseCount: bundleCourses.length, amount: parseFloat(String(payment.amount)), currency: "INR" });
        return;
      }

      // Single course payment
      const [existing] = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, payment.userId), eq(enrollmentsTable.courseId, payment.courseId))).limit(1);
      if (!existing) {
        await db.insert(enrollmentsTable).values({ userId: payment.userId, courseId: payment.courseId });
        const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
        await db.insert(notificationsTable).values({ userId: payment.userId, title: "Enrollment Confirmed!", message: `You are now enrolled in ${course?.title ?? "the course"}`, type: "success" });
        if (payment.couponCode) {
          const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, payment.couponCode)).limit(1);
          if (coupon) await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
        }
        const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
        const [course2] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
        if (buyer && course2) {
          triggerAutomation("purchase", buyer.id, buyer.email, { name: buyer.name, email: buyer.email, course_name: course2.title, amount: String(parseFloat(String(payment.amount)).toFixed(2)) }).catch(() => {});
          triggerFunnel("new_purchase", buyer.id, { course_name: course2.title, amount: String(parseFloat(String(payment.amount)).toFixed(2)), site_url: process.env.SITE_URL || "" }).catch(() => {});
        }
        await recordAffiliateCommission(payment.affiliateRef, payment.userId, payment.courseId, parseFloat(String(payment.amount)));
      }

      const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
      res.json({ success: true, enrolled: true, courseId: payment.courseId, courseTitle: course?.title, amount: parseFloat(String(payment.amount)), currency: "INR" });
    } else if (resultStatus === "PENDING") {
      res.json({ success: false, pending: true, status: resultStatus, message: "Payment is pending. Please wait a moment and try again." });
    } else {
      await db.update(paymentsTable).set({ status: "failed" }).where(eq(paymentsTable.id, payment.id));
      res.json({ success: false, failed: true, status: resultStatus, message: `Payment ${resultStatus || "failed"}. Please try again.` });
    }
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Paytm: Callback (redirect after payment on Paytm page) ───────────────────
router.post("/paytm/callback", async (req, res): Promise<void> => {
  const orderId = req.body?.ORDERID;
  res.redirect(`/payment-verify?gateway=paytm&order_id=${encodeURIComponent(orderId || "")}`);
});

// ── Paytm: Webhook (server-to-server payment notification) ────────────────────
router.post("/paytm/webhook", async (req, res): Promise<void> => {
  const event = req.body;
  const orderId: string | undefined = event?.ORDERID;
  const txnStatus: string | undefined = event?.STATUS;

  if (!orderId || txnStatus !== "TXN_SUCCESS") { res.json({ received: true }); return; }

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.gatewayOrderId, orderId)).limit(1);
  if (!payment || payment.status === "completed") { res.json({ received: true }); return; }

  const txnId: string = event?.TXNID ?? `ptm_wh_${nanoid(10)}`;
  await db.update(paymentsTable).set({ status: "completed", paymentId: txnId }).where(eq(paymentsTable.id, payment.id));
  generateGstInvoice(payment.id).catch(() => {});

  if (payment.bundleId && !payment.courseId) {
    const [bundle] = await db.select().from(bundlesTable).where(eq(bundlesTable.id, payment.bundleId)).limit(1);
    const bundleCourses = await db.select({ courseId: bundleCoursesTable.courseId }).from(bundleCoursesTable).where(eq(bundleCoursesTable.bundleId, payment.bundleId));
    for (const { courseId } of bundleCourses) {
      if (!courseId) continue;
      const [ex] = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, payment.userId), eq(enrollmentsTable.courseId, courseId))).limit(1);
      if (!ex) await db.insert(enrollmentsTable).values({ userId: payment.userId, courseId });
    }
    await db.insert(notificationsTable).values({ userId: payment.userId, title: "Package Enrolled! 🎉", message: `You now have access to all courses in "${bundle?.name ?? "the package"}".`, type: "success" });
    triggerFunnel("new_purchase", payment.userId, { course_name: bundle?.name ?? "", amount: String(parseFloat(String(payment.amount)).toFixed(2)), site_url: process.env.SITE_URL || "" }).catch(() => {});
    await recordAffiliateCommission(payment.affiliateRef, payment.userId, null, parseFloat(String(payment.amount)));
  } else {
    const [existing] = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, payment.userId), eq(enrollmentsTable.courseId, payment.courseId))).limit(1);
    if (!existing) {
      await db.insert(enrollmentsTable).values({ userId: payment.userId, courseId: payment.courseId });
      const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
      await db.insert(notificationsTable).values({ userId: payment.userId, title: "Enrollment Confirmed!", message: `You are now enrolled in ${course?.title ?? "the course"}`, type: "success" });
      const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
      if (buyer && course) {
        triggerAutomation("purchase", buyer.id, buyer.email, { name: buyer.name, email: buyer.email, course_name: course.title, amount: String(parseFloat(String(payment.amount)).toFixed(2)) }).catch(() => {});
        triggerFunnel("new_purchase", buyer.id, { course_name: course.title, amount: String(parseFloat(String(payment.amount)).toFixed(2)), site_url: process.env.SITE_URL || "" }).catch(() => {});
      }
      await recordAffiliateCommission(payment.affiliateRef, payment.userId, payment.courseId, parseFloat(String(payment.amount)));
    }
  }
  res.json({ received: true });
});

// ── Public: Active Gateways for Checkout ─────────────────────────────────────
router.get("/gateways/active", async (req, res): Promise<void> => {
  const gateways = await db.select({
    id: paymentGatewaysTable.id,
    name: paymentGatewaysTable.name,
    displayName: paymentGatewaysTable.displayName,
    apiKey: paymentGatewaysTable.apiKey,
    isTestMode: paymentGatewaysTable.isTestMode,
  }).from(paymentGatewaysTable).where(eq(paymentGatewaysTable.isActive, true));
  res.json(gateways);
});

// ── Initiate Real Payment ─────────────────────────────────────────────────────
router.post("/initiate", async (req, res): Promise<void> => {
  const { courseId, gateway: gatewayName, couponCode, amount: reqAmount } = req.body;
  if (!courseId || !gatewayName) { res.status(400).json({ error: "courseId and gateway required" }); return; }

  const [gw] = await db.select().from(paymentGatewaysTable).where(
    and(eq(paymentGatewaysTable.name, gatewayName), eq(paymentGatewaysTable.isActive, true))
  ).limit(1);
  if (!gw) { res.status(400).json({ error: "Gateway not configured or inactive" }); return; }

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, parseInt(courseId))).limit(1);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }

  let amount = reqAmount ?? parseFloat(course.price);
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode.toUpperCase())).limit(1);
    if (coupon?.isActive && (!coupon.maxUses || coupon.usedCount < coupon.maxUses)) {
      const d = parseFloat(String(coupon.discountValue));
      amount = coupon.discountType === "percentage" ? amount * (1 - d / 100) : Math.max(0, amount - d);
    }
  }

  const amountInPaise = Math.round(amount * 100);

  try {
    if (gatewayName === "razorpay") {
      const creds = Buffer.from(`${gw.apiKey}:${gw.secretKey}`).toString("base64");
      const r = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountInPaise, currency: "INR", receipt: `rcpt_${nanoid(8)}` }),
      });
      const order = await r.json();
      if (!r.ok) throw new Error(order.error?.description ?? "Razorpay order failed");
      res.json({ gateway: "razorpay", orderId: order.id, keyId: gw.apiKey, amount: amountInPaise, currency: "INR", courseName: course.title });

    } else if (gatewayName === "stripe") {
      const body = new URLSearchParams({ amount: String(amountInPaise), currency: "usd", "payment_method_types[]": "card" });
      const r = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: { Authorization: `Bearer ${gw.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const intent = await r.json();
      if (!r.ok) throw new Error(intent.error?.message ?? "Stripe PaymentIntent failed");
      res.json({ gateway: "stripe", clientSecret: intent.client_secret, publishableKey: gw.apiKey, amount: amountInPaise, currency: "usd", courseName: course.title });

    } else if (gatewayName === "cashfree") {
      const host = gw.isTestMode ? "https://sandbox.cashfree.com" : "https://api.cashfree.com";
      const r = await fetch(`${host}/pg/orders`, {
        method: "POST",
        headers: { "x-api-version": "2023-08-01", "x-client-id": gw.apiKey, "x-client-secret": gw.secretKey, "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: `ord_${nanoid(12)}`, order_amount: amount, order_currency: "INR", customer_details: { customer_id: "cust_01", customer_email: "buyer@example.com", customer_phone: "9999999999" } }),
      });
      const order = await r.json();
      if (!r.ok) throw new Error(order.message ?? "Cashfree order failed");
      res.json({ gateway: "cashfree", paymentSessionId: order.payment_session_id, orderId: order.order_id, amount, currency: "INR", appId: gw.apiKey, isTestMode: gw.isTestMode });

    } else if (gatewayName === "payu" || gatewayName === "paytm") {
      res.json({ gateway: gatewayName, amount, note: "Redirect gateway — use hosted checkout", keyId: gw.apiKey });
    } else {
      res.status(400).json({ error: "Unsupported gateway" });
    }
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Stripe: Create Order ──────────────────────────────────────────────────────
router.post("/stripe/create-order", async (req, res): Promise<void> => {
  const { courseId, email, fullName, state, mobile, couponCode, affiliateRef } = req.body;
  if (!courseId || !email || !fullName) {
    res.status(400).json({ error: "courseId, email, and fullName are required" }); return;
  }

  const [gw] = await db.select().from(paymentGatewaysTable).where(
    and(eq(paymentGatewaysTable.name, "stripe"), eq(paymentGatewaysTable.isActive, true))
  ).limit(1);
  if (!gw) { res.status(400).json({ error: "Stripe is not configured or inactive" }); return; }

  let userId: number;
  let isNewUser = false;
  let tempPassword: string | undefined;

  const existingToken = req.cookies?.token;
  if (existingToken) {
    try { const payload = verifyToken(existingToken); userId = payload.userId; }
    catch { userId = 0; }
  } else { userId = 0; }

  if (!userId) {
    const [existingUser] = await db.select().from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (existingUser) {
      userId = existingUser.id;
    } else {
      tempPassword = nanoid(10);
      const hashed = await bcrypt.hash(tempPassword, 10);
      const referralCode = nanoid(8).toUpperCase();
      const [newUser] = await db.insert(usersTable).values({
        email: email.toLowerCase().trim(), password: hashed,
        name: fullName.trim(), referralCode, role: "student",
      }).returning();
      userId = newUser.id;
      isNewUser = true;
    }
  }

  const [course] = await db.select().from(coursesTable)
    .where(eq(coursesTable.id, parseInt(courseId))).limit(1);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }

  let amount = parseFloat(course.price);
  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable)
      .where(eq(couponsTable.code, couponCode.toUpperCase())).limit(1);
    if (coupon && coupon.isActive && (!coupon.expiresAt || coupon.expiresAt > new Date()) &&
        (!coupon.maxUses || coupon.usedCount < coupon.maxUses)) {
      if (!coupon.courseId || coupon.courseId === parseInt(courseId)) {
        const discount = parseFloat(String(coupon.discountValue));
        amount = coupon.discountType === "percentage"
          ? amount * (1 - discount / 100)
          : Math.max(0, amount - discount);
      }
    }
  }

  const amountInPaise = Math.round(amount * 100);

  try {
    const body = new URLSearchParams({
      amount: String(amountInPaise),
      currency: "inr",
      "payment_method_types[]": "card",
      description: course.title,
      "metadata[course_id]": String(course.id),
      "metadata[course_title]": course.title,
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
      userId, courseId: parseInt(courseId),
      amount: String(amount.toFixed(2)), currency: "INR",
      status: "pending", gateway: "stripe",
      sessionId, paymentId: intent.id,
      couponCode: couponCode || null, affiliateRef: affiliateRef || null,
      billingName: fullName?.trim() || null, billingEmail: email?.toLowerCase().trim() || null,
      billingMobile: mobile?.trim() || null, billingState: state || null,
    });

    const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (freshUser) {
      const token = signToken({ userId: freshUser.id, email: freshUser.email, role: freshUser.role });
      res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    }

    const { password: _p, ...safeUser } = freshUser!;
    res.json({
      clientSecret: intent.client_secret, publishableKey: gw.apiKey,
      sessionId, paymentIntentId: intent.id, amount,
      isNewUser, tempPassword, user: safeUser,
      courseTitle: course.title, courseId: parseInt(courseId),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Stripe: Verify Payment ────────────────────────────────────────────────────
router.post("/stripe/verify", async (req, res): Promise<void> => {
  const { paymentIntentId, sessionId } = req.body;
  if (!paymentIntentId || !sessionId) {
    res.status(400).json({ error: "paymentIntentId and sessionId are required" }); return;
  }

  const [payment] = await db.select().from(paymentsTable)
    .where(eq(paymentsTable.sessionId, sessionId)).limit(1);
  if (!payment) { res.status(404).json({ error: "Payment session not found" }); return; }

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
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
    const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
    const { password: _p2, ...safeUser } = freshUser!;
    res.json({ success: true, alreadyEnrolled: true, courseId: payment.courseId, courseTitle: course?.title, user: safeUser });
    return;
  }

  await db.update(paymentsTable).set({ status: "completed", paymentId: paymentIntentId })
    .where(eq(paymentsTable.id, payment.id));
  generateGstInvoice(payment.id).catch(() => {});

  const [existing] = await db.select().from(enrollmentsTable)
    .where(and(eq(enrollmentsTable.userId, payment.userId), eq(enrollmentsTable.courseId, payment.courseId)))
    .limit(1);

  if (!existing) {
    await db.insert(enrollmentsTable).values({ userId: payment.userId, courseId: payment.courseId });
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
    await db.insert(notificationsTable).values({
      userId: payment.userId, title: "Enrollment Confirmed!",
      message: `You are now enrolled in ${course?.title ?? "the course"}`, type: "success",
    });
    const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
    if (buyer) {
      triggerAutomation("purchase", buyer.id, buyer.email, {
        name: buyer.name, email: buyer.email,
        course_name: course?.title ?? "",
        amount: String(parseFloat(String(payment.amount)).toFixed(2)),
      }).catch(() => {});
      triggerFunnel("new_purchase", buyer.id, { course_name: course?.title ?? "", amount: String(parseFloat(String(payment.amount)).toFixed(2)), site_url: process.env.SITE_URL || "" }).catch(() => {});
      await recordAffiliateCommission(payment.affiliateRef, payment.userId, payment.courseId, parseFloat(String(payment.amount)));
    }
  }

  if (payment.couponCode) {
    const [coupon] = await db.select().from(couponsTable)
      .where(eq(couponsTable.code, payment.couponCode)).limit(1);
    if (coupon) await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 })
      .where(eq(couponsTable.id, coupon.id));
  }

  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
  const { password: _p3, ...safeUser } = freshUser!;
  res.json({ success: true, courseId: payment.courseId, courseTitle: course?.title, user: safeUser });
});

export default router;

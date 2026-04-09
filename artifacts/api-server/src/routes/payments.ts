import { Router } from "express";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { paymentsTable, coursesTable, enrollmentsTable, couponsTable, notificationsTable, usersTable, paymentGatewaysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, signToken, verifyToken, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";

const router = Router();
type AuthedRequest = Request & { user: JwtPayload };

router.post("/checkout", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const { courseId, couponCode, gateway } = req.body;
  if (!courseId || !gateway) { res.status(400).json({ error: "courseId and gateway are required" }); return; }

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }

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
    currency: "USD",
    status: "pending",
    gateway,
    sessionId,
    couponCode: couponCode || null,
  });

  res.json({ sessionId, amount, currency: "USD", gateway, redirectUrl: null, razorpayOrderId: null, razorpayKey: null });
});

router.post("/verify", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const { sessionId } = req.body;
  if (!sessionId) { res.status(400).json({ error: "sessionId is required" }); return; }

  const [payment] = await db.select().from(paymentsTable).where(and(eq(paymentsTable.sessionId, sessionId), eq(paymentsTable.userId, authedReq.user.userId))).limit(1);
  if (!payment) { res.status(404).json({ error: "Payment session not found" }); return; }

  await db.update(paymentsTable).set({ status: "completed", paymentId: `sim_${nanoid(12)}` }).where(eq(paymentsTable.id, payment.id));

  const existing = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, authedReq.user.userId), eq(enrollmentsTable.courseId, payment.courseId))).limit(1);
  let enrollmentId: number | null = null;
  if (existing.length === 0) {
    const [enrollment] = await db.insert(enrollmentsTable).values({ userId: authedReq.user.userId, courseId: payment.courseId }).returning();
    enrollmentId = enrollment.id;
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
    await db.insert(notificationsTable).values({ userId: authedReq.user.userId, title: "Enrollment Confirmed!", message: `You are now enrolled in ${course?.title ?? "the course"}`, type: "success" });
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
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, p.courseId)).limit(1);
    return { ...p, amount: parseFloat(String(p.amount)), course: course ? { ...course, price: parseFloat(course.price), moduleCount: 0, lessonCount: 0, enrollmentCount: 0 } : null };
  }));
  res.json(enriched);
});

// ── Guest / Auto-register Checkout ───────────────────────────────────────────
router.post("/checkout/guest", async (req, res): Promise<void> => {
  const { courseId, email, fullName, state, mobile, gateway, couponCode } = req.body;
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
  await db.insert(paymentsTable).values({
    userId, courseId: parseInt(courseId),
    amount: String(amount.toFixed(2)), currency: "USD",
    status: "completed", gateway,
    sessionId, paymentId: `sim_${nanoid(12)}`,
    couponCode: couponCode || null,
  });

  const [existing] = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, userId), eq(enrollmentsTable.courseId, parseInt(courseId)))).limit(1);
  if (!existing) {
    await db.insert(enrollmentsTable).values({ userId, courseId: parseInt(courseId) });
    await db.insert(notificationsTable).values({ userId, title: "Enrollment Confirmed!", message: `You are now enrolled in ${course.title}`, type: "success" });
  }

  // Auto-login: set JWT cookie
  const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const token = signToken({ userId: freshUser!.id, email: freshUser!.email, role: freshUser!.role });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });

  const { password: _, ...safeUser } = freshUser!;
  res.json({ success: true, isNewUser, tempPassword, user: safeUser, courseId: parseInt(courseId), courseTitle: course.title });
});

// ── Cashfree: Create Order + Pre-register User ───────────────────────────────
router.post("/cashfree/create-order", async (req, res): Promise<void> => {
  const { courseId, email, fullName, state, mobile, couponCode } = req.body;
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

  // Create Cashfree order
  const cfOrderId = `ord_${nanoid(14)}`;
  const host = gw.isTestMode ? "https://sandbox.cashfree.com" : "https://api.cashfree.com";

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
      res.status(400).json({ error: cfResp.message ?? "Failed to create Cashfree order" }); return;
    }
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message }); return;
  }

  // Store pending payment
  const sessionId = nanoid(32);
  await db.insert(paymentsTable).values({
    userId, courseId: parseInt(courseId),
    amount: String(amount.toFixed(2)), currency: "INR",
    status: "pending", gateway: "cashfree",
    sessionId, gatewayOrderId: cfOrderId,
    couponCode: couponCode || null,
  });

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
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
    res.json({ success: true, alreadyEnrolled: true, courseId: payment.courseId, courseTitle: course?.title });
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
      await db.update(paymentsTable).set({ status: "completed", paymentId: order.cf_order_id ? String(order.cf_order_id) : `cf_${nanoid(12)}` }).where(eq(paymentsTable.id, payment.id));

      // Enroll
      const [existing] = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, payment.userId), eq(enrollmentsTable.courseId, payment.courseId))).limit(1);
      if (!existing) {
        await db.insert(enrollmentsTable).values({ userId: payment.userId, courseId: payment.courseId });
        const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
        await db.insert(notificationsTable).values({ userId: payment.userId, title: "Enrollment Confirmed!", message: `You are now enrolled in ${course?.title ?? "the course"}`, type: "success" });
        // Update coupon usage
        if (payment.couponCode) {
          const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, payment.couponCode)).limit(1);
          if (coupon) await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
        }
      }

      const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
      res.json({ success: true, enrolled: true, courseId: payment.courseId, courseTitle: course?.title });
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
  // Cashfree sends webhook events; we verify and process payment completion
  const event = req.body;
  const orderId = event?.data?.order?.order_id;
  const orderStatus = event?.data?.order?.order_status;

  if (!orderId || orderStatus !== "PAID") { res.json({ received: true }); return; }

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.gatewayOrderId, orderId)).limit(1);
  if (!payment || payment.status === "completed") { res.json({ received: true }); return; }

  await db.update(paymentsTable).set({ status: "completed", paymentId: `cf_wh_${nanoid(10)}` }).where(eq(paymentsTable.id, payment.id));
  const [existing] = await db.select().from(enrollmentsTable).where(and(eq(enrollmentsTable.userId, payment.userId), eq(enrollmentsTable.courseId, payment.courseId))).limit(1);
  if (!existing) {
    await db.insert(enrollmentsTable).values({ userId: payment.userId, courseId: payment.courseId });
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
    await db.insert(notificationsTable).values({ userId: payment.userId, title: "Enrollment Confirmed!", message: `You are now enrolled in ${course?.title ?? "the course"}`, type: "success" });
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

export default router;

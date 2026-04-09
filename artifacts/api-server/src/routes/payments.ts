import { Router } from "express";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { paymentsTable, coursesTable, enrollmentsTable, couponsTable, notificationsTable, usersTable } from "@workspace/db";
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

export default router;

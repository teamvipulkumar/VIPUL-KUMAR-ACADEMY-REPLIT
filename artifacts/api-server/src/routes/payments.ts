import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { paymentsTable, coursesTable, enrollmentsTable, couponsTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type JwtPayload } from "../middlewares/auth";
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

export default router;

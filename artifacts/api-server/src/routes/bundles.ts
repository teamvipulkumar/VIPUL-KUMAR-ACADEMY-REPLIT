import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import {
  bundlesTable, bundleCoursesTable, coursesTable, paymentsTable,
  enrollmentsTable, notificationsTable, usersTable, couponsTable,
  platformSettingsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireAdmin, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";
import { triggerAutomation } from "./crm";

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

/* ── Public Routes ───────────────────────────────────────────────────────── */

router.get("/", async (_req, res): Promise<void> => {
  const bundles = await db.select().from(bundlesTable).where(eq(bundlesTable.isActive, true)).orderBy(desc(bundlesTable.createdAt));
  const enriched = await Promise.all(bundles.map(b => getBundleWithCourses(b.id)));
  res.json(enriched.filter(Boolean));
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

  const bundle = await getBundleWithCourses(payment.bundleId);
  if (!bundle) { res.status(404).json({ error: "Bundle not found" }); return; }

  const enrolledCourses: number[] = [];
  for (const course of bundle.courses) {
    if (!course.id) continue;
    const existing = await db.select().from(enrollmentsTable).where(
      and(eq(enrollmentsTable.userId, authedReq.user.userId), eq(enrollmentsTable.courseId, course.id))
    ).limit(1);
    if (existing.length === 0) {
      await db.insert(enrollmentsTable).values({ userId: authedReq.user.userId, courseId: course.id });
      enrolledCourses.push(course.id);
    }
  }

  await db.insert(notificationsTable).values({
    userId: authedReq.user.userId,
    title: "Bundle Enrolled! 🎉",
    message: `You now have access to all ${bundle.courses.length} courses in "${bundle.name}".`,
    type: "success",
  });

  if (payment.couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, payment.couponCode)).limit(1);
    if (coupon) await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
  }

  const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, authedReq.user.userId)).limit(1);
  if (buyer) {
    triggerAutomation("purchase", buyer.id, buyer.email, {
      name: buyer.name,
      email: buyer.email,
      course_name: bundle.name,
      amount: String(parseFloat(String(payment.amount)).toFixed(2)),
    }).catch(() => {});
  }

  res.json({ success: true, bundleId: payment.bundleId, enrolledCourses, bundleName: bundle.name });
});

export default router;

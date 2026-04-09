import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable, coursesTable, enrollmentsTable, paymentsTable, referralsTable,
  payoutRequestsTable, platformSettingsTable
} from "@workspace/db";
import { eq, count, sum, gte, and, ilike, or, sql } from "drizzle-orm";
import { requireAdmin, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";

const router = Router();
type AuthedRequest = Request & { user: JwtPayload };

router.get("/users", requireAdmin, async (req, res): Promise<void> => {
  const { search, role, limit = "20", offset = "0" } = req.query as Record<string, string>;
  let query = db.select({
    id: usersTable.id, email: usersTable.email, name: usersTable.name,
    role: usersTable.role, avatarUrl: usersTable.avatarUrl, referralCode: usersTable.referralCode,
    isBanned: usersTable.isBanned, createdAt: usersTable.createdAt,
  }).from(usersTable).$dynamic();

  const conditions = [];
  if (search) conditions.push(or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.email, `%${search}%`))!);
  if (role) conditions.push(eq(usersTable.role, role as "admin" | "student" | "affiliate"));
  if (conditions.length > 0) query = query.where(and(...conditions));

  const [users, totalResult] = await Promise.all([
    query.limit(parseInt(limit)).offset(parseInt(offset)),
    db.select({ count: count() }).from(usersTable).where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);
  res.json({ users, total: totalResult[0]?.count ?? 0, limit: parseInt(limit), offset: parseInt(offset) });
});

router.get("/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  const [user] = await db.select({
    id: usersTable.id, email: usersTable.email, name: usersTable.name,
    role: usersTable.role, avatarUrl: usersTable.avatarUrl, referralCode: usersTable.referralCode,
    isBanned: usersTable.isBanned, createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [enrollCount] = await db.select({ count: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.userId, userId));
  const [spentResult] = await db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable).where(and(eq(paymentsTable.userId, userId), eq(paymentsTable.status, "completed")));
  const referrals = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, userId));
  const affiliateEarnings = referrals.reduce((acc, r) => acc + parseFloat(String(r.commission ?? 0)), 0);

  res.json({ ...user, enrollmentCount: enrollCount?.count ?? 0, totalSpent: parseFloat(String(spentResult?.total ?? 0)), affiliateEarnings });
});

router.post("/users", requireAdmin, async (req, res): Promise<void> => {
  const { name, email, password, role = "student" } = req.body;
  if (!name || !email || !password) { res.status(400).json({ error: "name, email, and password are required" }); return; }
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing) { res.status(409).json({ error: "Email already registered" }); return; }
  const hashed = await bcrypt.hash(password, 10);
  const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  const [user] = await db.insert(usersTable).values({ name, email: email.toLowerCase(), password: hashed, role, referralCode }).returning({
    id: usersTable.id, email: usersTable.email, name: usersTable.name,
    role: usersTable.role, avatarUrl: usersTable.avatarUrl, referralCode: usersTable.referralCode,
    isBanned: usersTable.isBanned, createdAt: usersTable.createdAt,
  });
  res.status(201).json(user);
});

router.put("/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  const { name, email, role, isBanned, password } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email.toLowerCase();
  if (role !== undefined) updates.role = role;
  if (isBanned !== undefined) updates.isBanned = isBanned;
  if (password !== undefined && password.length > 0) updates.password = await bcrypt.hash(password, 10);
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning({
    id: usersTable.id, email: usersTable.email, name: usersTable.name,
    role: usersTable.role, avatarUrl: usersTable.avatarUrl, referralCode: usersTable.referralCode,
    isBanned: usersTable.isBanned, createdAt: usersTable.createdAt,
  });
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json(updated);
});

router.delete("/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  const authedReq = req as AuthedRequest;
  if (authedReq.user?.id === userId) { res.status(400).json({ error: "Cannot delete your own account" }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  res.json({ message: "User deleted" });
});

router.post("/users/:userId/ban", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  const { banned } = req.body;
  await db.update(usersTable).set({ isBanned: banned }).where(eq(usersTable.id, userId));
  res.json({ message: `User ${banned ? "banned" : "unbanned"}` });
});

router.get("/analytics", requireAdmin, async (req, res): Promise<void> => {
  const now = new Date();
  const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    [totalUsers], [totalCourses], [totalEnrollments],
    [totalRevenueResult], [newUsersResult], [newEnrollmentsResult], [monthRevenueResult]
  ] = await Promise.all([
    db.select({ count: count() }).from(usersTable),
    db.select({ count: count() }).from(coursesTable),
    db.select({ count: count() }).from(enrollmentsTable),
    db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable).where(eq(paymentsTable.status, "completed")),
    db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, monthAgo)),
    db.select({ count: count() }).from(enrollmentsTable).where(gte(enrollmentsTable.enrolledAt, monthAgo)),
    db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable).where(and(eq(paymentsTable.status, "completed"), gte(paymentsTable.createdAt, monthAgo))),
  ]);

  const topCourses = await db.select({
    id: coursesTable.id, title: coursesTable.title,
    enrollmentCount: count(enrollmentsTable.id),
  }).from(coursesTable).leftJoin(enrollmentsTable, eq(coursesTable.id, enrollmentsTable.courseId)).groupBy(coursesTable.id).orderBy(sql`count(${enrollmentsTable.id}) DESC`).limit(5);

  const recentPayments = await db.select().from(paymentsTable).where(eq(paymentsTable.status, "completed")).orderBy(paymentsTable.createdAt).limit(5);
  const enrichedPayments = await Promise.all(recentPayments.map(async (p) => {
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, p.courseId)).limit(1);
    return { ...p, amount: parseFloat(String(p.amount)), course: course ? { ...course, price: parseFloat(course.price), moduleCount: 0, lessonCount: 0, enrollmentCount: 0 } : null };
  }));

  res.json({
    totalUsers: totalUsers?.count ?? 0,
    totalCourses: totalCourses?.count ?? 0,
    totalEnrollments: totalEnrollments?.count ?? 0,
    totalRevenue: parseFloat(String(totalRevenueResult?.total ?? 0)),
    activeUsers: totalUsers?.count ?? 0,
    newUsersThisMonth: newUsersResult?.count ?? 0,
    newEnrollmentsThisMonth: newEnrollmentsResult?.count ?? 0,
    revenueThisMonth: parseFloat(String(monthRevenueResult?.total ?? 0)),
    topCourses: topCourses.map(c => ({ id: c.id, title: c.title, enrollmentCount: c.enrollmentCount, revenue: 0 })),
    recentPayments: enrichedPayments,
  });
});

router.get("/revenue", requireAdmin, async (req, res): Promise<void> => {
  const { period = "30d" } = req.query as Record<string, string>;
  const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "1y" ? 365 : 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const payments = await db.select().from(paymentsTable).where(and(eq(paymentsTable.status, "completed"), gte(paymentsTable.createdAt, startDate)));

  const byDate: Record<string, { revenue: number; enrollments: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split("T")[0];
    byDate[key] = { revenue: 0, enrollments: 0 };
  }
  for (const p of payments) {
    const key = new Date(p.createdAt).toISOString().split("T")[0];
    if (byDate[key]) {
      byDate[key].revenue += parseFloat(String(p.amount));
      byDate[key].enrollments += 1;
    }
  }

  const chartData = Object.entries(byDate).map(([date, data]) => ({ date, ...data }));
  const totalRevenue = payments.reduce((acc, p) => acc + parseFloat(String(p.amount)), 0);
  const byGateway = { stripe: 0, razorpay: 0 };
  for (const p of payments) {
    if (p.gateway === "stripe") byGateway.stripe += parseFloat(String(p.amount));
    else if (p.gateway === "razorpay") byGateway.razorpay += parseFloat(String(p.amount));
  }

  res.json({ period, totalRevenue, chartData, byGateway });
});

router.get("/affiliates", requireAdmin, async (req, res): Promise<void> => {
  const users = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, referralCode: usersTable.referralCode }).from(usersTable);
  const affiliateData = await Promise.all(users.map(async (u) => {
    const referrals = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, u.id));
    const totalEarnings = referrals.reduce((acc, r) => acc + parseFloat(String(r.commission ?? 0)), 0);
    const approvedPayouts = await db.select().from(payoutRequestsTable).where(and(eq(payoutRequestsTable.userId, u.id), eq(payoutRequestsTable.status, "approved")));
    const paidEarnings = approvedPayouts.reduce((acc, p) => acc + parseFloat(String(p.amount)), 0);
    return {
      ...u,
      totalClicks: referrals.filter(r => r.status === "click").length,
      totalConversions: referrals.filter(r => r.status === "purchase").length,
      totalEarnings,
      pendingEarnings: Math.max(0, totalEarnings - paidEarnings),
    };
  }));
  res.json(affiliateData.filter(a => a.totalClicks > 0 || a.totalEarnings > 0));
});

router.get("/payouts", requireAdmin, async (req, res): Promise<void> => {
  const payouts = await db.select().from(payoutRequestsTable).orderBy(payoutRequestsTable.requestedAt);
  const enriched = await Promise.all(payouts.map(async (p) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
    return { ...p, amount: parseFloat(String(p.amount)), userName: user?.name ?? "Unknown" };
  }));
  res.json(enriched);
});

router.post("/payouts/:payoutId/approve", requireAdmin, async (req, res): Promise<void> => {
  const payoutId = parseInt(req.params.payoutId);
  await db.update(payoutRequestsTable).set({ status: "approved", processedAt: new Date() }).where(eq(payoutRequestsTable.id, payoutId));
  res.json({ message: "Payout approved" });
});

router.post("/payouts/:payoutId/reject", requireAdmin, async (req, res): Promise<void> => {
  const payoutId = parseInt(req.params.payoutId);
  const { reason } = req.body;
  await db.update(payoutRequestsTable).set({ status: "rejected", rejectionReason: reason, processedAt: new Date() }).where(eq(payoutRequestsTable.id, payoutId));
  res.json({ message: "Payout rejected" });
});

router.get("/enrollments", requireAdmin, async (req, res): Promise<void> => {
  const { courseId, userId } = req.query as Record<string, string>;
  const conditions = [];
  if (courseId) conditions.push(eq(enrollmentsTable.courseId, parseInt(courseId)));
  if (userId) conditions.push(eq(enrollmentsTable.userId, parseInt(userId)));

  const enrollments = await db.select().from(enrollmentsTable).where(conditions.length > 0 ? and(...conditions) : undefined);
  const enriched = await Promise.all(enrollments.map(async (e) => {
    const [[user], [course]] = await Promise.all([
      db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, role: usersTable.role, avatarUrl: usersTable.avatarUrl, referralCode: usersTable.referralCode, isBanned: usersTable.isBanned, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, e.userId)).limit(1),
      db.select().from(coursesTable).where(eq(coursesTable.id, e.courseId)).limit(1),
    ]);
    return { ...e, progressPercent: 0, user, course: course ? { ...course, price: parseFloat(course.price), moduleCount: 0, lessonCount: 0, enrollmentCount: 0 } : null };
  }));
  res.json(enriched);
});

router.get("/courses", requireAdmin, async (req, res): Promise<void> => {
  const courses = await db.select().from(coursesTable).orderBy(coursesTable.createdAt);
  const enriched = await Promise.all(courses.map(async (c) => {
    const [enrollResult] = await db.select({ count: count() }).from(enrollmentsTable).where(eq(enrollmentsTable.courseId, c.id));
    return { ...c, price: parseFloat(c.price), moduleCount: 0, lessonCount: 0, enrollmentCount: enrollResult?.count ?? 0 };
  }));
  res.json(enriched);
});

router.get("/settings", requireAdmin, async (req, res): Promise<void> => {
  const settings = await db.select().from(platformSettingsTable).limit(1);
  if (settings.length === 0) {
    await db.insert(platformSettingsTable).values({});
    const [newSettings] = await db.select().from(platformSettingsTable).limit(1);
    res.json({ ...newSettings, commissionRate: newSettings.commissionRate / 100 });
    return;
  }
  res.json({ ...settings[0], commissionRate: settings[0].commissionRate / 100 });
});

router.put("/settings", requireAdmin, async (req, res): Promise<void> => {
  const { siteName, siteDescription, commissionRate, currency, stripeEnabled, razorpayEnabled, emailNotificationsEnabled } = req.body;
  const existing = await db.select().from(platformSettingsTable).limit(1);
  const updates: Record<string, unknown> = {};
  if (siteName !== undefined) updates.siteName = siteName;
  if (siteDescription !== undefined) updates.siteDescription = siteDescription;
  if (commissionRate !== undefined) updates.commissionRate = Math.round(commissionRate * 100);
  if (currency !== undefined) updates.currency = currency;
  if (stripeEnabled !== undefined) updates.stripeEnabled = stripeEnabled;
  if (razorpayEnabled !== undefined) updates.razorpayEnabled = razorpayEnabled;
  if (emailNotificationsEnabled !== undefined) updates.emailNotificationsEnabled = emailNotificationsEnabled;

  if (existing.length === 0) {
    await db.insert(platformSettingsTable).values({});
  }
  const [updated] = await db.update(platformSettingsTable).set(updates).returning();
  res.json({ ...updated, commissionRate: updated.commissionRate / 100 });
});

export default router;

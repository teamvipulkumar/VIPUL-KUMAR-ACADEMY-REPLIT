import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable, coursesTable, modulesTable, enrollmentsTable, paymentsTable, referralsTable,
  payoutRequestsTable, platformSettingsTable, lessonCompletionsTable, lessonsTable,
  paymentGatewaysTable
} from "@workspace/db";
import { eq, count, sum, gte, and, ilike, or, sql, desc, ne } from "drizzle-orm";
import { requireAdmin, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";
import { triggerAutomation } from "./crm";

const router = Router();
type AuthedRequest = Request & { user: JwtPayload };

router.get("/users", requireAdmin, async (req, res): Promise<void> => {
  const { search, role, limit = "20", offset = "0" } = req.query as Record<string, string>;
  let query = db.select({
    id: usersTable.id, email: usersTable.email, name: usersTable.name,
    role: usersTable.role, avatarUrl: usersTable.avatarUrl, referralCode: usersTable.referralCode,
    isBanned: usersTable.isBanned, createdAt: usersTable.createdAt,
    phone: (usersTable as any).phone,
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
    phone: (usersTable as any).phone,
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
  const { name, email, role, isBanned, password, phone } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email.toLowerCase();
  if (role !== undefined) updates.role = role;
  if (isBanned !== undefined) updates.isBanned = isBanned;
  if (password !== undefined && password.length > 0) updates.password = await bcrypt.hash(password, 10);
  if (phone !== undefined) updates.phone = phone.trim() || null;
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

// ── Export users as CSV ───────────────────────────────────────────────────────
router.get("/users/export", requireAdmin, async (req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id, name: usersTable.name, email: usersTable.email,
    role: usersTable.role, isBanned: usersTable.isBanned,
    phone: (usersTable as any).phone,
    referralCode: usersTable.referralCode, createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(desc(usersTable.createdAt));

  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ["ID", "Name", "Email", "Role", "Status", "Phone", "Referral Code", "Joined Date"];
  const rows = users.map(u => [
    u.id, u.name, u.email, u.role,
    u.isBanned ? "banned" : "active",
    u.phone ?? "",
    u.referralCode ?? "",
    new Date(u.createdAt).toISOString().split("T")[0],
  ].map(escape).join(","));

  const csv = [header.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="users-${new Date().toISOString().split("T")[0]}.csv"`);
  res.send(csv);
});

// ── Import users from CSV/JSON ────────────────────────────────────────────────
router.post("/users/import", requireAdmin, async (req, res): Promise<void> => {
  const rows: Array<{ name: string; email: string; password: string; role?: string }> = req.body?.users;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "Provide a non-empty users array" }); return;
  }
  if (rows.length > 500) {
    res.status(400).json({ error: "Maximum 500 users per import" }); return;
  }

  const created: number[] = [];
  const errors: Array<{ row: number; email: string; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.name?.trim() || !r.email?.trim() || !r.password?.trim()) {
      errors.push({ row: i + 1, email: r.email ?? "", error: "name, email, and password are required" }); continue;
    }
    const emailLower = r.email.trim().toLowerCase();
    const role = (["admin", "student", "affiliate"].includes(r.role ?? "")) ? r.role as string : "student";
    try {
      const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, emailLower)).limit(1);
      if (existing) { errors.push({ row: i + 1, email: emailLower, error: "Email already exists" }); continue; }
      const hashed = await bcrypt.hash(r.password.trim(), 10);
      const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const [user] = await db.insert(usersTable).values({ name: r.name.trim(), email: emailLower, password: hashed, role: role as "admin" | "student" | "affiliate", referralCode }).returning({ id: usersTable.id });
      created.push(user.id);
    } catch {
      errors.push({ row: i + 1, email: emailLower, error: "Database error" });
    }
  }

  res.json({ created: created.length, errors, total: rows.length });
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
  const [payout] = await db.select().from(payoutRequestsTable).where(eq(payoutRequestsTable.id, payoutId)).limit(1);
  await db.update(payoutRequestsTable).set({ status: "approved", processedAt: new Date() }).where(eq(payoutRequestsTable.id, payoutId));
  if (payout) {
    const [affiliateUser] = await db.select().from(usersTable).where(eq(usersTable.id, payout.userId)).limit(1);
    if (affiliateUser) {
      triggerAutomation("affiliate_commission", affiliateUser.id, affiliateUser.email, {
        name: affiliateUser.name,
        email: affiliateUser.email,
        payout_amount: String(parseFloat(String(payout.amount)).toFixed(2)),
        commission_amount: String(parseFloat(String(payout.amount)).toFixed(2)),
      }).catch(() => {});
    }
  }
  res.json({ message: "Payout approved" });
});

router.post("/payouts/:payoutId/reject", requireAdmin, async (req, res): Promise<void> => {
  const payoutId = parseInt(req.params.payoutId);
  const { reason } = req.body;
  await db.update(payoutRequestsTable).set({ status: "rejected", rejectionReason: reason, processedAt: new Date() }).where(eq(payoutRequestsTable.id, payoutId));
  res.json({ message: "Payout rejected" });
});

router.get("/enrollments", requireAdmin, async (req, res): Promise<void> => {
  const { search, courseId, limit = "100", offset = "0" } = req.query as Record<string, string>;

  const rows = await db.select({
    id: enrollmentsTable.id,
    userId: enrollmentsTable.userId,
    courseId: enrollmentsTable.courseId,
    enrolledAt: enrollmentsTable.enrolledAt,
    completedAt: enrollmentsTable.completedAt,
    userName: usersTable.name,
    userEmail: usersTable.email,
    courseTitle: coursesTable.title,
    courseThumbnail: coursesTable.thumbnailUrl,
  })
  .from(enrollmentsTable)
  .innerJoin(usersTable, eq(enrollmentsTable.userId, usersTable.id))
  .innerJoin(coursesTable, eq(enrollmentsTable.courseId, coursesTable.id))
  .where(courseId ? eq(enrollmentsTable.courseId, parseInt(courseId)) : undefined)
  .orderBy(desc(enrollmentsTable.enrolledAt))
  .limit(parseInt(limit))
  .offset(parseInt(offset));

  let result = rows;
  if (search) {
    const s = search.toLowerCase();
    result = rows.filter(r =>
      r.userName.toLowerCase().includes(s) ||
      r.userEmail.toLowerCase().includes(s) ||
      r.courseTitle.toLowerCase().includes(s)
    );
  }

  const [totalResult] = await db.select({ total: count() }).from(enrollmentsTable);
  const [completedResult] = await db.select({ total: count() }).from(enrollmentsTable).where(sql`completed_at IS NOT NULL`);

  res.json({
    enrollments: result,
    total: totalResult?.total ?? 0,
    stats: {
      total: totalResult?.total ?? 0,
      completed: completedResult?.total ?? 0,
      active: (totalResult?.total ?? 0) - (completedResult?.total ?? 0),
    }
  });
});

router.post("/enrollments", requireAdmin, async (req, res): Promise<void> => {
  const { userId, courseId } = req.body;
  if (!userId || !courseId) { res.status(400).json({ error: "userId and courseId are required" }); return; }

  const [user] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, parseInt(userId))).limit(1);
  const [course] = await db.select({ id: coursesTable.id, title: coursesTable.title }).from(coursesTable).where(eq(coursesTable.id, parseInt(courseId))).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }

  const [existing] = await db.select({ id: enrollmentsTable.id }).from(enrollmentsTable)
    .where(and(eq(enrollmentsTable.userId, parseInt(userId)), eq(enrollmentsTable.courseId, parseInt(courseId)))).limit(1);
  if (existing) { res.status(409).json({ error: `${user.name} is already enrolled in "${course.title}"` }); return; }

  const [enrollment] = await db.insert(enrollmentsTable).values({ userId: parseInt(userId), courseId: parseInt(courseId) }).returning();
  res.status(201).json({ ...enrollment, userName: user.name, courseTitle: course.title });
});

router.delete("/enrollments/:enrollmentId", requireAdmin, async (req, res): Promise<void> => {
  const enrollmentId = parseInt(req.params.enrollmentId);
  const [enrollment] = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.id, enrollmentId)).limit(1);
  if (!enrollment) { res.status(404).json({ error: "Enrollment not found" }); return; }

  const courseModules = await db.select({ id: modulesTable.id }).from(modulesTable).where(eq(modulesTable.courseId, enrollment.courseId));
  for (const mod of courseModules) {
    const modLessons = await db.select({ id: lessonsTable.id }).from(lessonsTable).where(eq(lessonsTable.moduleId, mod.id));
    for (const lesson of modLessons) {
      await db.delete(lessonCompletionsTable).where(and(eq(lessonCompletionsTable.userId, enrollment.userId), eq(lessonCompletionsTable.lessonId, lesson.id)));
    }
  }

  await db.delete(enrollmentsTable).where(eq(enrollmentsTable.id, enrollmentId));
  res.json({ message: "Enrollment removed" });
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
  const { siteName, siteDescription, commissionRate, currency, stripeEnabled, razorpayEnabled, emailNotificationsEnabled, googleSignInEnabled, googleClientId, googleClientSecret, maintenanceMode, maintenanceMessage } = req.body;
  const existing = await db.select().from(platformSettingsTable).limit(1);
  const updates: Record<string, unknown> = {};
  if (siteName !== undefined) updates.siteName = siteName;
  if (siteDescription !== undefined) updates.siteDescription = siteDescription;
  if (commissionRate !== undefined) updates.commissionRate = Math.round(commissionRate * 100);
  if (currency !== undefined) updates.currency = currency;
  if (stripeEnabled !== undefined) updates.stripeEnabled = stripeEnabled;
  if (razorpayEnabled !== undefined) updates.razorpayEnabled = razorpayEnabled;
  if (emailNotificationsEnabled !== undefined) updates.emailNotificationsEnabled = emailNotificationsEnabled;
  if (googleSignInEnabled !== undefined) updates.googleSignInEnabled = googleSignInEnabled;
  if (googleClientId !== undefined) updates.googleClientId = googleClientId;
  if (googleClientSecret !== undefined) updates.googleClientSecret = googleClientSecret;
  if (maintenanceMode !== undefined) updates.maintenanceMode = maintenanceMode;
  if (maintenanceMessage !== undefined) updates.maintenanceMessage = maintenanceMessage;

  if (existing.length === 0) {
    await db.insert(platformSettingsTable).values({});
  }
  const [updated] = await db.update(platformSettingsTable).set(updates).returning();
  res.json({ ...updated, commissionRate: updated.commissionRate / 100 });
});

router.get("/orders", requireAdmin, async (req, res): Promise<void> => {
  const { search, status, gateway, limit = "50", offset = "0" } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof eq>[] = [];
  if (status && status !== "all") conditions.push(eq(paymentsTable.status, status as "pending" | "completed" | "failed" | "refunded"));
  if (gateway && gateway !== "all") conditions.push(eq(paymentsTable.gateway, gateway as "stripe" | "razorpay"));

  const baseQuery = db
    .select({
      id: paymentsTable.id,
      userId: paymentsTable.userId,
      courseId: paymentsTable.courseId,
      amount: paymentsTable.amount,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      gateway: paymentsTable.gateway,
      couponCode: paymentsTable.couponCode,
      paymentId: paymentsTable.paymentId,
      createdAt: paymentsTable.createdAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      courseTitle: coursesTable.title,
    })
    .from(paymentsTable)
    .innerJoin(usersTable, eq(paymentsTable.userId, usersTable.id))
    .innerJoin(coursesTable, eq(paymentsTable.courseId, coursesTable.id));

  let orders = await baseQuery.where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(paymentsTable.createdAt)).limit(parseInt(limit)).offset(parseInt(offset));

  if (search) {
    const s = search.toLowerCase();
    orders = orders.filter(o =>
      o.userName.toLowerCase().includes(s) ||
      o.userEmail.toLowerCase().includes(s) ||
      o.courseTitle.toLowerCase().includes(s) ||
      String(o.id).includes(s)
    );
  }

  const [totalResult] = await db.select({ total: count() }).from(paymentsTable).where(conditions.length > 0 ? and(...conditions) : undefined);
  const [revenueResult] = await db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable).where(eq(paymentsTable.status, "completed"));
  const [pendingResult] = await db.select({ total: count() }).from(paymentsTable).where(eq(paymentsTable.status, "pending"));
  const [refundedResult] = await db.select({ total: count() }).from(paymentsTable).where(eq(paymentsTable.status, "refunded"));

  res.json({
    orders,
    total: totalResult?.total ?? 0,
    stats: {
      totalRevenue: parseFloat(String(revenueResult?.total ?? 0)),
      totalOrders: totalResult?.total ?? 0,
      pendingOrders: pendingResult?.total ?? 0,
      refundedOrders: refundedResult?.total ?? 0,
    }
  });
});

router.post("/orders/:orderId/refund", requireAdmin, async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId);
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, orderId)).limit(1);
  if (!payment) { res.status(404).json({ error: "Order not found" }); return; }
  if (payment.status === "refunded") { res.status(400).json({ error: "Order already refunded" }); return; }
  if (payment.status !== "completed") { res.status(400).json({ error: "Only completed orders can be refunded" }); return; }

  await db.update(paymentsTable).set({ status: "refunded" }).where(eq(paymentsTable.id, orderId));

  // Fire refund automation
  const [refundUser] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId)).limit(1);
  const [refundCourse] = await db.select().from(coursesTable).where(eq(coursesTable.id, payment.courseId)).limit(1);
  if (refundUser && refundCourse) {
    triggerAutomation("refund", refundUser.id, refundUser.email, {
      name: refundUser.name,
      email: refundUser.email,
      course_name: refundCourse.title,
      amount: String(parseFloat(String(payment.amount)).toFixed(2)),
    }).catch(() => {});
  }

  // Lessons belong to modules, modules belong to courses — join through modules
  const courseModules = await db.select({ id: modulesTable.id }).from(modulesTable).where(eq(modulesTable.courseId, payment.courseId));
  if (courseModules.length > 0) {
    for (const mod of courseModules) {
      const modLessons = await db.select({ id: lessonsTable.id }).from(lessonsTable).where(eq(lessonsTable.moduleId, mod.id));
      for (const lesson of modLessons) {
        await db.delete(lessonCompletionsTable).where(and(eq(lessonCompletionsTable.userId, payment.userId), eq(lessonCompletionsTable.lessonId, lesson.id)));
      }
    }
  }

  await db.delete(enrollmentsTable).where(and(eq(enrollmentsTable.userId, payment.userId), eq(enrollmentsTable.courseId, payment.courseId)));

  res.json({ message: "Refund processed. User has been unenrolled from the course." });
});

// ── Payment Gateways ──────────────────────────────────────────────────────────
const SUPPORTED_GATEWAYS = [
  { name: "stripe", displayName: "Stripe", keyLabel: "Publishable Key", secretLabel: "Secret Key", supportedCountries: "Global" },
  { name: "razorpay", displayName: "Razorpay", keyLabel: "Key ID", secretLabel: "Key Secret", supportedCountries: "India" },
  { name: "cashfree", displayName: "Cashfree", keyLabel: "App ID", secretLabel: "Secret Key", supportedCountries: "India" },
  { name: "paytm", displayName: "Paytm Payments", keyLabel: "Merchant ID", secretLabel: "Merchant Key", supportedCountries: "India" },
  { name: "payu", displayName: "PayU", keyLabel: "Merchant Key", secretLabel: "Merchant Salt", supportedCountries: "India" },
];

const maskValue = (v: string | null | undefined) =>
  v ? v.replace(/./g, "•") : "";

router.get("/payment-gateways", requireAdmin, async (req, res): Promise<void> => {
  const gateways = await db.select().from(paymentGatewaysTable);
  const result = SUPPORTED_GATEWAYS.map(sg => {
    const config = gateways.find(g => g.name === sg.name);
    return {
      ...sg,
      id: config?.id ?? null,
      apiKey: config?.apiKey ?? "",
      secretKey: maskValue(config?.secretKey),
      webhookSecret: maskValue(config?.webhookSecret),
      isActive: config?.isActive ?? false,
      isTestMode: config?.isTestMode ?? true,
      isConfigured: !!(config?.apiKey && config?.secretKey),
    };
  });
  res.json(result);
});

router.put("/payment-gateways/:name", requireAdmin, async (req, res): Promise<void> => {
  const { name } = req.params;
  const supported = SUPPORTED_GATEWAYS.find(g => g.name === name);
  if (!supported) { res.status(400).json({ error: "Unsupported gateway" }); return; }

  const { apiKey, secretKey, webhookSecret, isActive, isTestMode } = req.body;

  const [existing] = await db.select().from(paymentGatewaysTable).where(eq(paymentGatewaysTable.name, name)).limit(1);

  if (existing) {
    const update: { isActive: boolean; isTestMode: boolean; updatedAt: Date; apiKey?: string; secretKey?: string; webhookSecret?: string | null } = {
      isActive: isActive ?? existing.isActive,
      isTestMode: isTestMode ?? existing.isTestMode,
      updatedAt: new Date(),
    };
    const isBulletMask = (v: string | undefined) => typeof v === "string" && v.length > 0 && /^•+$/.test(v);
    const trimmedApiKey = typeof apiKey === "string" ? apiKey.trim() : apiKey;
    const trimmedSecretKey = typeof secretKey === "string" ? secretKey.trim() : secretKey;
    if (!isBulletMask(trimmedApiKey) && trimmedApiKey !== "") update.apiKey = trimmedApiKey;
    if (!isBulletMask(trimmedSecretKey) && trimmedSecretKey !== "") update.secretKey = trimmedSecretKey;
    if (webhookSecret !== undefined && !isBulletMask(webhookSecret)) update.webhookSecret = webhookSecret?.trim() || null;
    const [updated] = await db.update(paymentGatewaysTable).set(update).where(eq(paymentGatewaysTable.name, name)).returning();
    res.json({ ...updated, secretKey: maskValue(updated.secretKey), webhookSecret: maskValue(updated.webhookSecret) });
  } else {
    if (!apiKey || !secretKey) { res.status(400).json({ error: "API Key and Secret Key are required" }); return; }
    const [created] = await db.insert(paymentGatewaysTable).values({
      name, displayName: supported.displayName,
      apiKey, secretKey, webhookSecret: webhookSecret || null,
      isActive: isActive ?? false, isTestMode: isTestMode ?? true,
    }).returning();
    res.json({ ...created, secretKey: maskValue(created.secretKey), webhookSecret: maskValue(created.webhookSecret) });
  }
});

router.delete("/payment-gateways/:name", requireAdmin, async (req, res): Promise<void> => {
  const { name } = req.params;
  await db.delete(paymentGatewaysTable).where(eq(paymentGatewaysTable.name, name));
  res.json({ message: "Gateway configuration removed" });
});

router.get("/payment-gateways/:name/test", requireAdmin, async (req, res): Promise<void> => {
  const { name } = req.params;
  const [gw] = await db.select().from(paymentGatewaysTable).where(eq(paymentGatewaysTable.name, name)).limit(1);
  if (!gw || !gw.apiKey || !gw.secretKey) { res.status(400).json({ error: "Gateway not configured" }); return; }

  try {
    if (name === "razorpay") {
      const creds = Buffer.from(`${gw.apiKey}:${gw.secretKey}`).toString("base64");
      const r = await fetch("https://api.razorpay.com/v1/orders?count=1", { headers: { Authorization: `Basic ${creds}` } });
      if (!r.ok) throw new Error(`Razorpay API error: ${r.status}`);
    } else if (name === "stripe") {
      const r = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${gw.secretKey}` } });
      if (!r.ok) throw new Error(`Stripe API error: ${r.status}`);
    } else if (name === "cashfree") {
      const r = await fetch(`https://${gw.isTestMode ? "sandbox" : "api"}.cashfree.com/pg/orders?limit=1`, {
        headers: { "x-api-version": "2023-08-01", "x-client-id": gw.apiKey, "x-client-secret": gw.secretKey }
      });
      if (r.status === 401) throw new Error("Invalid Cashfree credentials");
    } else {
      res.json({ success: true, message: `${name} credentials saved (connection test not available for this gateway)` }); return;
    }
    res.json({ success: true, message: "Connection successful! Gateway is configured correctly." });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/* ── Public: maintenance status (no auth required) ── */
router.get("/public/maintenance", async (_req, res): Promise<void> => {
  const settings = await db.select({
    maintenanceMode: platformSettingsTable.maintenanceMode,
    maintenanceMessage: platformSettingsTable.maintenanceMessage,
  }).from(platformSettingsTable).limit(1);
  if (settings.length === 0) { res.json({ maintenanceMode: false, maintenanceMessage: null }); return; }
  res.json(settings[0]);
});

export default router;

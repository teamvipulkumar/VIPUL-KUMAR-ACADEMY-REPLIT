import { Router } from "express";
import { db } from "@workspace/db";
import { enrollmentsTable, paymentsTable, referralsTable, notificationsTable, usersTable, coursesTable } from "@workspace/db";
import { eq, and, count, sum } from "drizzle-orm";
import { requireAuth, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";

const router = Router();
type AuthedRequest = Request & { user: JwtPayload };

router.get("/summary", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const userId = authedReq.user.userId;

  const [
    enrollments,
    [spentResult],
    referrals,
    [unreadResult],
  ] = await Promise.all([
    db.select().from(enrollmentsTable).where(eq(enrollmentsTable.userId, userId)),
    db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable).where(and(eq(paymentsTable.userId, userId), eq(paymentsTable.status, "completed"))),
    db.select().from(referralsTable).where(eq(referralsTable.referrerId, userId)),
    db.select({ count: count() }).from(notificationsTable).where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false))),
  ]);

  const completedCourses = enrollments.filter(e => e.completedAt).length;
  const affiliateEarnings = referrals.reduce((acc, r) => acc + parseFloat(String(r.commission ?? 0)), 0);

  res.json({
    enrolledCourses: enrollments.length,
    completedCourses,
    totalSpent: parseFloat(String(spentResult?.total ?? 0)),
    affiliateEarnings,
    referralCount: referrals.filter(r => r.status === "purchase").length,
    unreadNotifications: unreadResult?.count ?? 0,
  });
});

router.get("/recent-activity", async (req, res): Promise<void> => {
  const { limit = "10" } = req.query as Record<string, string>;
  const recentEnrollments = await db.select().from(enrollmentsTable).orderBy(enrollmentsTable.enrolledAt).limit(5);
  const recentPayments = await db.select().from(paymentsTable).where(eq(paymentsTable.status, "completed")).orderBy(paymentsTable.createdAt).limit(5);

  const activities = [];
  let idCounter = 1;

  for (const e of recentEnrollments) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, e.userId)).limit(1);
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, e.courseId)).limit(1);
    activities.push({
      id: idCounter++,
      type: "enrollment",
      description: `${user?.name ?? "A user"} enrolled in ${course?.title ?? "a course"}`,
      userId: e.userId,
      userName: user?.name ?? null,
      createdAt: e.enrolledAt,
    });
  }

  for (const p of recentPayments) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, p.courseId)).limit(1);
    activities.push({
      id: idCounter++,
      type: "payment",
      description: `${user?.name ?? "A user"} purchased ${course?.title ?? "a course"} for $${parseFloat(String(p.amount)).toFixed(2)}`,
      userId: p.userId,
      userName: user?.name ?? null,
      createdAt: p.createdAt,
    });
  }

  activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(activities.slice(0, parseInt(limit)));
});

export default router;

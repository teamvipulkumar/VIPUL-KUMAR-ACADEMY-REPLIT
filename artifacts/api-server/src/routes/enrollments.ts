import { Router } from "express";
import { db } from "@workspace/db";
import { enrollmentsTable, lessonCompletionsTable, coursesTable, modulesTable, lessonsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";

const router = Router();
type AuthedRequest = Request & { user: JwtPayload };

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const enrollments = await db.select().from(enrollmentsTable).where(eq(enrollmentsTable.userId, authedReq.user.userId));
  const enriched = await Promise.all(enrollments.map(async (e) => {
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, e.courseId)).limit(1);
    const totalLessons = await db.select({ count: count() }).from(lessonsTable)
      .innerJoin(modulesTable, eq(lessonsTable.moduleId, modulesTable.id))
      .where(eq(modulesTable.courseId, e.courseId));
    const completedLessons = await db.select({ count: count() }).from(lessonCompletionsTable)
      .innerJoin(lessonsTable, eq(lessonCompletionsTable.lessonId, lessonsTable.id))
      .innerJoin(modulesTable, eq(lessonsTable.moduleId, modulesTable.id))
      .where(and(eq(lessonCompletionsTable.userId, authedReq.user.userId), eq(modulesTable.courseId, e.courseId)));
    const total = totalLessons[0]?.count ?? 0;
    const completed = completedLessons[0]?.count ?? 0;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      ...e,
      progressPercent,
      course: course ? { ...course, price: parseFloat(course.price), moduleCount: 0, lessonCount: 0, enrollmentCount: 0 } : null,
    };
  }));
  res.json(enriched);
});

router.get("/:courseId/progress", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const courseId = parseInt(req.params.courseId);
  const totalLessons = await db.select({ count: count() }).from(lessonsTable)
    .innerJoin(modulesTable, eq(lessonsTable.moduleId, modulesTable.id))
    .where(eq(modulesTable.courseId, courseId));
  const completedLessons = await db.select({ count: count() }).from(lessonCompletionsTable)
    .innerJoin(lessonsTable, eq(lessonCompletionsTable.lessonId, lessonsTable.id))
    .innerJoin(modulesTable, eq(lessonsTable.moduleId, modulesTable.id))
    .where(and(eq(lessonCompletionsTable.userId, authedReq.user.userId), eq(modulesTable.courseId, courseId)));
  const total = totalLessons[0]?.count ?? 0;
  const completed = completedLessons[0]?.count ?? 0;
  res.json({ courseId, progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0, completedLessons: completed, totalLessons: total, lastActivityAt: null });
});

export default router;

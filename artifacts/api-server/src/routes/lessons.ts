import { Router } from "express";
import { db } from "@workspace/db";
import { lessonCompletionsTable, lessonsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";

const router = Router();
type AuthedRequest = Request & { user: JwtPayload };

router.post("/:lessonId/complete", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const lessonId = parseInt(req.params.lessonId);
  const existing = await db.select().from(lessonCompletionsTable).where(and(eq(lessonCompletionsTable.userId, authedReq.user.userId), eq(lessonCompletionsTable.lessonId, lessonId))).limit(1);
  if (existing.length === 0) {
    await db.insert(lessonCompletionsTable).values({ userId: authedReq.user.userId, lessonId });
  }
  res.json({ message: "Lesson marked as complete" });
});

export default router;

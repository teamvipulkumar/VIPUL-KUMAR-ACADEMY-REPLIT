import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";

const router = Router();
type AuthedRequest = Request & { user: JwtPayload };

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const notifications = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, authedReq.user.userId)).orderBy(notificationsTable.createdAt);
  res.json(notifications.reverse());
});

router.post("/:notificationId/read", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const notifId = parseInt(req.params.notificationId);
  await db.update(notificationsTable).set({ isRead: true }).where(and(eq(notificationsTable.id, notifId), eq(notificationsTable.userId, authedReq.user.userId)));
  res.json({ message: "Notification marked as read" });
});

router.post("/read-all", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, authedReq.user.userId));
  res.json({ message: "All notifications marked as read" });
});

export default router;

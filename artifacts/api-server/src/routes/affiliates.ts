import { Router } from "express";
import { db } from "@workspace/db";
import { referralsTable, payoutRequestsTable, usersTable, platformSettingsTable, paymentsTable } from "@workspace/db";
import { eq, and, sum, count, sql } from "drizzle-orm";
import { requireAuth, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";

const router = Router();
type AuthedRequest = Request & { user: JwtPayload };

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, authedReq.user.userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const settings = await db.select().from(platformSettingsTable).limit(1);
  const commissionRate = settings[0]?.commissionRate ?? 20;

  const referrals = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, authedReq.user.userId));
  const clicks = referrals.filter(r => r.status === "click").length + referrals.filter(r => r.status === "signup").length + referrals.filter(r => r.status === "purchase").length;
  const conversions = referrals.filter(r => r.status === "purchase").length;
  const totalEarnings = referrals.reduce((acc, r) => acc + parseFloat(String(r.commission ?? 0)), 0);

  const approvedPayouts = await db.select().from(payoutRequestsTable).where(and(eq(payoutRequestsTable.userId, authedReq.user.userId), eq(payoutRequestsTable.status, "approved")));
  const paidEarnings = approvedPayouts.reduce((acc, p) => acc + parseFloat(String(p.amount)), 0);

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost:80";
  res.json({
    referralCode: user.referralCode,
    referralLink: `https://${domain}?ref=${user.referralCode}`,
    totalClicks: clicks,
    totalConversions: conversions,
    totalEarnings,
    pendingEarnings: Math.max(0, totalEarnings - paidEarnings),
    paidEarnings,
    commissionRate,
  });
});

router.get("/referrals", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const referrals = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, authedReq.user.userId)).orderBy(referralsTable.createdAt);
  const enriched = await Promise.all(referrals.map(async (r) => {
    let referredUserName = "Anonymous";
    if (r.referredUserId) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, r.referredUserId)).limit(1);
      if (u) referredUserName = u.name;
    }
    return { ...r, referredUserName, commission: r.commission ? parseFloat(String(r.commission)) : null };
  }));
  res.json(enriched);
});

router.post("/payout-request", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const { amount, paymentMethod, paymentDetails } = req.body;
  if (!amount || !paymentMethod || !paymentDetails) { res.status(400).json({ error: "amount, paymentMethod and paymentDetails are required" }); return; }
  await db.insert(payoutRequestsTable).values({ userId: authedReq.user.userId, amount: String(amount), paymentMethod, paymentDetails, status: "pending" });
  res.json({ message: "Payout request submitted" });
});

router.post("/track", async (req, res): Promise<void> => {
  const { referralCode, courseId } = req.body;
  if (!referralCode) { res.status(400).json({ error: "referralCode is required" }); return; }
  const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode)).limit(1);
  if (referrer) {
    await db.insert(referralsTable).values({ referrerId: referrer.id, courseId: courseId || null, status: "click" });
  }
  res.json({ message: "Tracked" });
});

export default router;

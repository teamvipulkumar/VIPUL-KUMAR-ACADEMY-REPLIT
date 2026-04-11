import { Router } from "express";
import { db } from "@workspace/db";
import {
  referralsTable, payoutRequestsTable, usersTable, platformSettingsTable,
  affiliateApplicationsTable, affiliateClicksTable, affiliateKycTable,
  affiliateBankDetailsTable, affiliateCreativesTable, affiliatePixelTable,
  coursesTable, paymentsTable,
} from "@workspace/db";
import { eq, and, sum, count, sql, desc, gte, lt, ne } from "drizzle-orm";
import { requireAuth, requireAdmin, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";
import crypto from "crypto";

const router = Router();
type AuthedRequest = Request & { user: JwtPayload };

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").substring(0, 16);
}

function dayStart(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ── Application ── */
router.post("/apply", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const { fullName, email, promoteDescription } = req.body;
  if (!fullName || !email || !promoteDescription) {
    res.status(400).json({ error: "All fields are required" }); return;
  }
  const existing = await db.select().from(affiliateApplicationsTable)
    .where(eq(affiliateApplicationsTable.userId, authedReq.user.userId)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "You have already applied", status: existing[0].status }); return;
  }
  const [app] = await db.insert(affiliateApplicationsTable).values({
    userId: authedReq.user.userId, fullName, email, promoteDescription, status: "pending",
  }).returning();
  res.json(app);
});

router.get("/application", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const [app] = await db.select().from(affiliateApplicationsTable)
    .where(eq(affiliateApplicationsTable.userId, authedReq.user.userId)).limit(1);
  if (!app) { res.status(404).json({ error: "No application found" }); return; }
  res.json(app);
});

/* ── Dashboard / earnings ── */
router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, authedReq.user.userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const settings = await db.select().from(platformSettingsTable).limit(1);
  const commissionRate = settings[0]?.commissionRate ?? 20;

  const referrals = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, authedReq.user.userId));
  const allClicks = await db.select().from(affiliateClicksTable).where(eq(affiliateClicksTable.affiliateId, authedReq.user.userId));
  const clicks = allClicks.length;
  const uniqueClicks = allClicks.filter(c => c.isUnique).length;
  const conversions = referrals.filter(r => r.status === "purchase").length;
  const totalEarnings = referrals.reduce((acc, r) => acc + parseFloat(String(r.commission ?? 0)), 0);

  const approvedPayouts = await db.select().from(payoutRequestsTable)
    .where(and(eq(payoutRequestsTable.userId, authedReq.user.userId), eq(payoutRequestsTable.status, "approved")));
  const paidEarnings = approvedPayouts.reduce((acc, p) => acc + parseFloat(String(p.amount)), 0);

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost:80";

  /* Earnings breakdown */
  const todayStart = dayStart(0);
  const yesterdayStart = dayStart(1);
  const day7Start = dayStart(7);
  const day30Start = dayStart(30);

  const earnInRange = (from: Date, to?: Date) =>
    referrals
      .filter(r => {
        const d = new Date(r.createdAt);
        return d >= from && (to ? d < to : true) && r.commission;
      })
      .reduce((s, r) => s + parseFloat(String(r.commission ?? 0)), 0);

  const todayEarnings = earnInRange(todayStart);
  const yesterdayEarnings = earnInRange(yesterdayStart, todayStart);
  const last7Earnings = earnInRange(day7Start);
  const last30Earnings = earnInRange(day30Start);

  /* Daily chart — last 30 days */
  const daily: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = dayStart(i);
    const key = d.toISOString().substring(0, 10);
    daily[key] = 0;
  }
  referrals.filter(r => r.commission && new Date(r.createdAt) >= day30Start).forEach(r => {
    const key = new Date(r.createdAt).toISOString().substring(0, 10);
    if (key in daily) daily[key] += parseFloat(String(r.commission ?? 0));
  });
  const dailyChart = Object.entries(daily).map(([date, amount]) => ({ date, amount }));

  res.json({
    referralCode: user.referralCode,
    referralLink: `https://${domain}?ref=${user.referralCode}`,
    totalClicks: clicks,
    uniqueClicks,
    totalConversions: conversions,
    totalEarnings,
    pendingEarnings: Math.max(0, totalEarnings - paidEarnings),
    paidEarnings,
    commissionRate,
    todayEarnings,
    yesterdayEarnings,
    last7Earnings,
    last30Earnings,
    dailyChart,
  });
});

router.get("/referrals", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const referrals = await db.select().from(referralsTable)
    .where(eq(referralsTable.referrerId, authedReq.user.userId))
    .orderBy(desc(referralsTable.createdAt));
  const enriched = await Promise.all(referrals.map(async (r) => {
    let referredUserName = "Anonymous";
    if (r.referredUserId) {
      const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.referredUserId)).limit(1);
      if (u) referredUserName = u.name;
    }
    return { ...r, referredUserName, commission: r.commission ? parseFloat(String(r.commission)) : null };
  }));
  res.json(enriched);
});

/* ── Click analytics ── */
router.get("/clicks", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const userId = authedReq.user.userId;

  const [clicks, purchases] = await Promise.all([
    db.select().from(affiliateClicksTable)
      .where(eq(affiliateClicksTable.affiliateId, userId))
      .orderBy(desc(affiliateClicksTable.createdAt)),
    db.select().from(referralsTable)
      .where(and(eq(referralsTable.referrerId, userId), eq(referralsTable.status, "purchase"))),
  ]);

  const total = clicks.length;
  const unique = clicks.filter(c => c.isUnique).length;
  const conversions = purchases.length; // ground truth: actual purchases, not click.convertedAt

  const day30Start = dayStart(30);
  const daily: Record<string, { clicks: number; unique: number; conversions: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = dayStart(i);
    daily[d.toISOString().substring(0, 10)] = { clicks: 0, unique: 0, conversions: 0 };
  }
  clicks.filter(c => new Date(c.createdAt) >= day30Start).forEach(c => {
    const key = new Date(c.createdAt).toISOString().substring(0, 10);
    if (key in daily) {
      daily[key].clicks++;
      if (c.isUnique) daily[key].unique++;
    }
  });
  // Map purchases to the chart by their creation date
  purchases.filter(p => new Date(p.createdAt) >= day30Start).forEach(p => {
    const key = new Date(p.createdAt).toISOString().substring(0, 10);
    if (key in daily) daily[key].conversions++;
  });

  const dailyChart = Object.entries(daily).map(([date, v]) => ({ date, ...v }));
  res.json({ total, unique, conversions, dailyChart });
});

/* ── Sales list ── */
router.get("/sales", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const userId = authedReq.user.userId;

  const rows = await db
    .select({
      id: referralsTable.id,
      commission: referralsTable.commission,
      createdAt: referralsTable.createdAt,
      courseId: referralsTable.courseId,
      courseTitle: coursesTable.title,
      saleAmount: paymentsTable.amount,
    })
    .from(referralsTable)
    .leftJoin(coursesTable, eq(coursesTable.id, referralsTable.courseId))
    .leftJoin(
      paymentsTable,
      and(
        eq(paymentsTable.userId, referralsTable.referredUserId),
        eq(paymentsTable.courseId, referralsTable.courseId),
        eq(paymentsTable.status, "completed"),
      ),
    )
    .where(and(eq(referralsTable.referrerId, userId), eq(referralsTable.status, "purchase")))
    .orderBy(desc(referralsTable.createdAt));

  res.json(rows.map(r => ({
    id: r.id,
    courseTitle: r.courseTitle ?? "Unknown Course",
    saleAmount: r.saleAmount != null ? parseFloat(String(r.saleAmount)) : null,
    commission: parseFloat(String(r.commission ?? 0)),
    createdAt: r.createdAt,
  })));
});

/* ── Payout ── */
router.post("/payout-request", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const { amount, paymentMethod, paymentDetails } = req.body;
  if (!amount || !paymentMethod || !paymentDetails) {
    res.status(400).json({ error: "amount, paymentMethod and paymentDetails are required" }); return;
  }
  await db.insert(payoutRequestsTable).values({
    userId: authedReq.user.userId, amount: String(amount), paymentMethod, paymentDetails, status: "pending",
  });
  res.json({ message: "Payout request submitted" });
});

router.get("/payouts", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const payouts = await db.select().from(payoutRequestsTable)
    .where(eq(payoutRequestsTable.userId, authedReq.user.userId))
    .orderBy(desc(payoutRequestsTable.requestedAt));
  res.json(payouts.map(p => ({ ...p, amount: parseFloat(String(p.amount)) })));
});

/* ── KYC ── */
router.get("/kyc", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const [kyc] = await db.select().from(affiliateKycTable)
    .where(eq(affiliateKycTable.userId, authedReq.user.userId)).limit(1);
  res.json(kyc ?? null);
});

router.post("/kyc", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const { idProofName, addressProofName } = req.body;
  if (!idProofName || !addressProofName) {
    res.status(400).json({ error: "Both ID proof and address proof names are required" }); return;
  }
  const [existing] = await db.select().from(affiliateKycTable)
    .where(eq(affiliateKycTable.userId, authedReq.user.userId)).limit(1);
  if (existing) {
    const [updated] = await db.update(affiliateKycTable)
      .set({ idProofName, addressProofName, status: "pending", adminNote: null, submittedAt: new Date() })
      .where(eq(affiliateKycTable.userId, authedReq.user.userId)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(affiliateKycTable).values({
      userId: authedReq.user.userId, idProofName, addressProofName, status: "pending",
    }).returning();
    res.json(created);
  }
});

/* ── Bank details ── */
router.get("/bank", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const [bank] = await db.select().from(affiliateBankDetailsTable)
    .where(eq(affiliateBankDetailsTable.userId, authedReq.user.userId)).limit(1);
  res.json(bank ?? null);
});

router.post("/bank", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;
  if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
    res.status(400).json({ error: "All bank details are required" }); return;
  }
  const [existing] = await db.select().from(affiliateBankDetailsTable)
    .where(eq(affiliateBankDetailsTable.userId, authedReq.user.userId)).limit(1);
  if (existing) {
    const [updated] = await db.update(affiliateBankDetailsTable)
      .set({ accountHolderName, accountNumber, ifscCode, bankName })
      .where(eq(affiliateBankDetailsTable.userId, authedReq.user.userId)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(affiliateBankDetailsTable)
      .values({ userId: authedReq.user.userId, accountHolderName, accountNumber, ifscCode, bankName }).returning();
    res.json(created);
  }
});

/* ── Pixel ── */
router.get("/pixel", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const [pixel] = await db.select().from(affiliatePixelTable)
    .where(eq(affiliatePixelTable.userId, authedReq.user.userId)).limit(1);
  res.json(pixel ?? null);
});

router.post("/pixel", requireAuth, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const { facebookPixelId, trackPageView, trackPurchase } = req.body;
  const [existing] = await db.select().from(affiliatePixelTable)
    .where(eq(affiliatePixelTable.userId, authedReq.user.userId)).limit(1);
  if (existing) {
    const [updated] = await db.update(affiliatePixelTable)
      .set({ facebookPixelId: facebookPixelId || null, trackPageView: trackPageView ?? true, trackPurchase: trackPurchase ?? true })
      .where(eq(affiliatePixelTable.userId, authedReq.user.userId)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(affiliatePixelTable)
      .values({ userId: authedReq.user.userId, facebookPixelId: facebookPixelId || null, trackPageView: trackPageView ?? true, trackPurchase: trackPurchase ?? true }).returning();
    res.json(created);
  }
});

/* ── Creatives ── */
router.get("/creatives", requireAuth, async (req, res): Promise<void> => {
  const creatives = await db.select().from(affiliateCreativesTable).orderBy(desc(affiliateCreativesTable.createdAt));
  res.json(creatives);
});

/* ── Track click ── */
router.post("/track", async (req, res): Promise<void> => {
  const { referralCode, courseId } = req.body;
  if (!referralCode) { res.status(400).json({ error: "referralCode is required" }); return; }
  const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode)).limit(1);
  if (referrer) {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
    const ipHash = hashIp(ip);
    /* Basic duplicate check within 24h */
    const oneDayAgo = new Date(Date.now() - 86400000);
    const recentClick = await db.select({ id: affiliateClicksTable.id }).from(affiliateClicksTable)
      .where(and(
        eq(affiliateClicksTable.affiliateId, referrer.id),
        eq(affiliateClicksTable.ipHash, ipHash),
        gte(affiliateClicksTable.createdAt, oneDayAgo),
      )).limit(1);
    const isUnique = recentClick.length === 0;
    await db.insert(affiliateClicksTable).values({
      affiliateId: referrer.id,
      ipHash,
      userAgent: req.headers["user-agent"]?.substring(0, 200) ?? null,
      courseId: courseId || null,
      isUnique,
    });
    /* Also create a referral record for backward compat */
    await db.insert(referralsTable).values({ referrerId: referrer.id, courseId: courseId || null, status: "click" });
  }
  res.json({ message: "Tracked" });
});

/* ── Admin: affiliate applications ── */
router.get("/admin/applications", requireAdmin, async (req, res): Promise<void> => {
  const apps = await db.select().from(affiliateApplicationsTable).orderBy(desc(affiliateApplicationsTable.createdAt));
  const enriched = await Promise.all(apps.map(async (a) => {
    const [user] = await db.select({ name: usersTable.name, email: usersTable.email, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, a.userId)).limit(1);
    return { ...a, userName: user?.name ?? "Unknown", userEmail: user?.email ?? "", userRole: user?.role ?? "student" };
  }));
  res.json(enriched);
});

router.post("/admin/applications/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [app] = await db.select().from(affiliateApplicationsTable).where(eq(affiliateApplicationsTable.id, id)).limit(1);
  if (!app) { res.status(404).json({ error: "Application not found" }); return; }
  await db.update(affiliateApplicationsTable)
    .set({ status: "approved", reviewedAt: new Date() })
    .where(eq(affiliateApplicationsTable.id, id));
  await db.update(usersTable).set({ role: "affiliate" }).where(eq(usersTable.id, app.userId));
  res.json({ message: "Application approved, user promoted to affiliate" });
});

router.post("/admin/applications/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { adminNote } = req.body;
  if (!adminNote) { res.status(400).json({ error: "adminNote is required when rejecting" }); return; }
  const [app] = await db.select().from(affiliateApplicationsTable).where(eq(affiliateApplicationsTable.id, id)).limit(1);
  if (!app) { res.status(404).json({ error: "Application not found" }); return; }
  await db.update(affiliateApplicationsTable)
    .set({ status: "rejected", adminNote, reviewedAt: new Date() })
    .where(eq(affiliateApplicationsTable.id, id));
  res.json({ message: "Application rejected" });
});

/* ── Admin: creatives CRUD ── */
router.post("/admin/creatives", requireAdmin, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const { title, type, url, content, description } = req.body;
  if (!title || !type) { res.status(400).json({ error: "title and type are required" }); return; }
  const [creative] = await db.insert(affiliateCreativesTable).values({
    title, type, url: url || null, content: content || null, description: description || null,
    uploadedByAdminId: authedReq.user.userId,
  }).returning();
  res.json(creative);
});

router.delete("/admin/creatives/:id", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(affiliateCreativesTable).where(eq(affiliateCreativesTable.id, parseInt(req.params.id)));
  res.json({ message: "Creative deleted" });
});

/* ── Admin: KYC review ── */
router.post("/admin/kyc/:userId/approve", requireAdmin, async (req, res): Promise<void> => {
  await db.update(affiliateKycTable)
    .set({ status: "approved", reviewedAt: new Date() })
    .where(eq(affiliateKycTable.userId, parseInt(req.params.userId)));
  res.json({ message: "KYC approved" });
});

router.post("/admin/kyc/:userId/reject", requireAdmin, async (req, res): Promise<void> => {
  const { adminNote } = req.body;
  await db.update(affiliateKycTable)
    .set({ status: "rejected", adminNote: adminNote || "Rejected by admin", reviewedAt: new Date() })
    .where(eq(affiliateKycTable.userId, parseInt(req.params.userId)));
  res.json({ message: "KYC rejected" });
});

/* ── Admin: all affiliates list ── */
router.get("/admin/all-affiliates", requireAdmin, async (req, res): Promise<void> => {
  const apps = await db.select().from(affiliateApplicationsTable)
    .where(eq(affiliateApplicationsTable.status, "approved"))
    .orderBy(desc(affiliateApplicationsTable.createdAt));

  const enriched = await Promise.all(apps.map(async (a) => {
    const [user] = await db.select({ name: usersTable.name, email: usersTable.email, referralCode: usersTable.referralCode, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, a.userId)).limit(1);

    const referrals = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, a.userId));
    const totalClicks = referrals.length;
    const totalConversions = referrals.filter(r => r.status === "purchase").length;
    const totalEarnings = referrals.reduce((acc, r) => acc + parseFloat(String(r.commission ?? 0)), 0);

    const payouts = await db.select().from(payoutRequestsTable).where(eq(payoutRequestsTable.userId, a.userId));
    const paidOut = payouts.filter(p => p.status === "approved").reduce((acc, p) => acc + parseFloat(String(p.amount)), 0);
    const pendingPayout = payouts.filter(p => p.status === "pending").reduce((acc, p) => acc + parseFloat(String(p.amount)), 0);

    const [kyc] = await db.select({ status: affiliateKycTable.status }).from(affiliateKycTable)
      .where(eq(affiliateKycTable.userId, a.userId)).limit(1);

    return {
      applicationId: a.id,
      userId: a.userId,
      name: user?.name ?? a.fullName,
      email: user?.email ?? a.email,
      referralCode: user?.referralCode ?? null,
      role: user?.role ?? "affiliate",
      isBlocked: a.isBlocked,
      commissionOverride: a.commissionOverride,
      approvedAt: a.reviewedAt,
      totalClicks,
      totalConversions,
      totalEarnings,
      pendingPayout,
      paidOut,
      kycStatus: kyc?.status ?? "not_submitted",
    };
  }));
  res.json(enriched);
});

/* ── Admin: block / unblock affiliate ── */
router.post("/admin/affiliates/:appId/block", requireAdmin, async (req, res): Promise<void> => {
  const appId = parseInt(req.params.appId);
  await db.update(affiliateApplicationsTable).set({ isBlocked: true }).where(eq(affiliateApplicationsTable.id, appId));
  res.json({ message: "Affiliate blocked" });
});

router.post("/admin/affiliates/:appId/unblock", requireAdmin, async (req, res): Promise<void> => {
  const appId = parseInt(req.params.appId);
  await db.update(affiliateApplicationsTable).set({ isBlocked: false }).where(eq(affiliateApplicationsTable.id, appId));
  res.json({ message: "Affiliate unblocked" });
});

/* ── Admin: set per-affiliate commission ── */
router.post("/admin/affiliates/:appId/commission", requireAdmin, async (req, res): Promise<void> => {
  const appId = parseInt(req.params.appId);
  const { commissionRate } = req.body;
  const rate = commissionRate === null || commissionRate === "" ? null : parseInt(String(commissionRate));
  await db.update(affiliateApplicationsTable)
    .set({ commissionOverride: rate })
    .where(eq(affiliateApplicationsTable.id, appId));
  res.json({ message: "Commission updated" });
});

/* ── Admin: all payout requests ── */
router.get("/admin/all-payouts", requireAdmin, async (req, res): Promise<void> => {
  const payouts = await db.select().from(payoutRequestsTable).orderBy(desc(payoutRequestsTable.requestedAt));
  const enriched = await Promise.all(payouts.map(async (p) => {
    const [user] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
    const [bank] = await db.select().from(affiliateBankDetailsTable)
      .where(eq(affiliateBankDetailsTable.userId, p.userId)).limit(1);
    return {
      ...p,
      amount: parseFloat(String(p.amount)),
      userName: user?.name ?? "Unknown",
      userEmail: user?.email ?? "",
      bankName: bank?.bankName ?? null,
      accountNumber: bank?.accountNumber ?? null,
    };
  }));
  res.json(enriched);
});

router.post("/admin/payouts/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.update(payoutRequestsTable)
    .set({ status: "approved", processedAt: new Date() })
    .where(eq(payoutRequestsTable.id, id));
  res.json({ message: "Payout approved" });
});

router.post("/admin/payouts/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { rejectionReason } = req.body;
  await db.update(payoutRequestsTable)
    .set({ status: "rejected", rejectionReason: rejectionReason || "Rejected by admin", processedAt: new Date() })
    .where(eq(payoutRequestsTable.id, id));
  res.json({ message: "Payout rejected" });
});

/* ── Admin: all KYC submissions ── */
router.get("/admin/all-kyc", requireAdmin, async (req, res): Promise<void> => {
  const submissions = await db.select().from(affiliateKycTable).orderBy(desc(affiliateKycTable.submittedAt));
  const enriched = await Promise.all(submissions.map(async (k) => {
    const [user] = await db.select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, k.userId)).limit(1);
    return { ...k, userName: user?.name ?? "Unknown", userEmail: user?.email ?? "" };
  }));
  res.json(enriched);
});

/* ── Admin: affiliate program settings ── */
router.get("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const [settings] = await db.select().from(platformSettingsTable).limit(1);
  if (!settings) { res.json({ commissionRate: 20, affiliateEnabled: true, affiliateCookieDays: 30, affiliateMinPayout: 500 }); return; }
  res.json({
    commissionRate: settings.commissionRate,
    affiliateEnabled: settings.affiliateEnabled,
    affiliateCookieDays: settings.affiliateCookieDays,
    affiliateMinPayout: settings.affiliateMinPayout,
  });
});

router.post("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const { commissionRate, affiliateEnabled, affiliateCookieDays, affiliateMinPayout } = req.body;
  const [existing] = await db.select().from(platformSettingsTable).limit(1);
  const updates = {
    ...(commissionRate !== undefined && { commissionRate: parseInt(String(commissionRate)) }),
    ...(affiliateEnabled !== undefined && { affiliateEnabled: Boolean(affiliateEnabled) }),
    ...(affiliateCookieDays !== undefined && { affiliateCookieDays: parseInt(String(affiliateCookieDays)) }),
    ...(affiliateMinPayout !== undefined && { affiliateMinPayout: parseInt(String(affiliateMinPayout)) }),
  };
  if (existing) {
    await db.update(platformSettingsTable).set(updates).where(eq(platformSettingsTable.id, existing.id));
  } else {
    await db.insert(platformSettingsTable).values({ siteName: "Vipul Kumar Academy", siteDescription: "", ...updates });
  }
  res.json({ message: "Settings saved" });
});

export default router;

import { Router } from "express";
import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import {
  smtpSettingsTable, emailTemplatesTable, emailCampaignsTable,
  emailAutomationRulesTable, emailSendsTable, usersTable, enrollmentsTable,
} from "@workspace/db";
import { eq, count, sql, and, notInArray } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

/* ── helpers ── */
async function getSmtp() {
  const [row] = await db.select().from(smtpSettingsTable).limit(1);
  return row ?? null;
}

export async function createTransporter(smtp: typeof smtpSettingsTable.$inferSelect) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.username, pass: smtp.password },
  } as nodemailer.TransportOptions);
}

function buildFrom(smtp: typeof smtpSettingsTable.$inferSelect) {
  return `"${smtp.fromName}" <${smtp.fromEmail}>`;
}

/** Public function called from other routes to fire automation emails */
export async function triggerAutomation(
  event: "welcome" | "purchase" | "refund" | "forgot_password" | "completion" | "affiliate_commission",
  userId: number,
  email: string,
  variables: Record<string, string> = {},
) {
  try {
    const smtp = await getSmtp();
    if (!smtp || !smtp.isActive) return;

    const [rule] = await db.select().from(emailAutomationRulesTable)
      .where(and(eq(emailAutomationRulesTable.event, event), eq(emailAutomationRulesTable.isEnabled, true)))
      .limit(1);
    if (!rule || !rule.templateId) return;

    const [template] = await db.select().from(emailTemplatesTable)
      .where(and(eq(emailTemplatesTable.id, rule.templateId), eq(emailTemplatesTable.isActive, true)))
      .limit(1);
    if (!template) return;

    let html = template.htmlBody;
    let subject = template.subject;
    for (const [key, val] of Object.entries(variables)) {
      html = html.replaceAll(`{{${key}}}`, val);
      subject = subject.replaceAll(`{{${key}}}`, val);
    }

    const transporter = await createTransporter(smtp);
    const send = async () => {
      try {
        await transporter.sendMail({ from: buildFrom(smtp), to: email, subject, html });
        await db.insert(emailSendsTable).values({ type: "automation", automationEvent: event, userId, email, subject, status: "sent" });
      } catch (err: any) {
        await db.insert(emailSendsTable).values({ type: "automation", automationEvent: event, userId, email, subject, status: "failed", failReason: String(err?.message ?? err) });
      }
    };

    if (rule.delayMinutes > 0) {
      setTimeout(send, rule.delayMinutes * 60 * 1000);
    } else {
      send();
    }
  } catch {
  }
}

/* ── SMTP ── */
router.get("/smtp", requireAdmin, async (_req, res): Promise<void> => {
  const smtp = await getSmtp();
  if (!smtp) { res.json(null); return; }
  const { password: _pw, ...safe } = smtp;
  res.json({ ...safe, passwordSet: !!_pw });
});

router.put("/smtp", requireAdmin, async (req, res): Promise<void> => {
  const { host, port, secure, username, password, fromName, fromEmail, isActive } = req.body;
  const existing = await getSmtp();
  const values: Record<string, unknown> = { host, port: parseInt(String(port)) || 587, secure: !!secure, username, fromName, fromEmail, isActive: !!isActive };
  if (password) values.password = password;

  if (existing) {
    const [updated] = await db.update(smtpSettingsTable).set(values).where(eq(smtpSettingsTable.id, existing.id)).returning();
    const { password: _pw, ...safe } = updated;
    res.json({ ...safe, passwordSet: !!_pw });
  } else {
    if (!password) { res.status(400).json({ error: "Password required for first setup" }); return; }
    const [created] = await db.insert(smtpSettingsTable).values({ ...values, password } as any).returning();
    const { password: _pw, ...safe } = created;
    res.json({ ...safe, passwordSet: !!_pw });
  }
});

router.post("/smtp/test", requireAdmin, async (req, res): Promise<void> => {
  const smtp = await getSmtp();
  if (!smtp || !smtp.host) { res.status(400).json({ error: "SMTP not configured" }); return; }
  const { to } = req.body;
  if (!to) { res.status(400).json({ error: "Recipient email required" }); return; }
  try {
    const transporter = await createTransporter(smtp);
    await transporter.sendMail({
      from: buildFrom(smtp),
      to,
      subject: "VK Academy — SMTP Test",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;background:#0a0f1e;color:#e2e8f0;border-radius:12px;">
        <h2 style="color:#2563eb;">✅ SMTP Test Successful</h2>
        <p>Your SMTP configuration is working correctly.</p>
        <p style="color:#64748b;font-size:12px;">Sent from VK Academy CRM</p>
      </div>`,
    });
    await db.insert(emailSendsTable).values({ type: "test", email: to, subject: "VK Academy — SMTP Test", status: "sent" });
    res.json({ success: true, message: "Test email sent successfully" });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to send: ${err?.message ?? "Unknown error"}` });
  }
});

/* ── Templates ── */
router.get("/templates", requireAdmin, async (_req, res): Promise<void> => {
  const templates = await db.select().from(emailTemplatesTable).orderBy(emailTemplatesTable.createdAt);
  res.json(templates);
});

router.post("/templates", requireAdmin, async (req, res): Promise<void> => {
  const { name, type, subject, htmlBody, isActive } = req.body;
  if (!name || !subject || !htmlBody) { res.status(400).json({ error: "name, subject, htmlBody required" }); return; }
  const [t] = await db.insert(emailTemplatesTable).values({ name, type: type ?? "custom", subject, htmlBody, isActive: isActive !== false }).returning();
  res.status(201).json(t);
});

router.put("/templates/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, type, subject, htmlBody, isActive } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (subject !== undefined) updates.subject = subject;
  if (htmlBody !== undefined) updates.htmlBody = htmlBody;
  if (isActive !== undefined) updates.isActive = isActive;
  const [t] = await db.update(emailTemplatesTable).set(updates).where(eq(emailTemplatesTable.id, id)).returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  res.json(t);
});

router.delete("/templates/:id", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(emailTemplatesTable).where(eq(emailTemplatesTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

/* ── Automation ── */
const AUTOMATION_EVENTS = [
  { event: "welcome", label: "Welcome Email", description: "Sent when a new user registers" },
  { event: "purchase", label: "Purchase Confirmation", description: "Sent after a successful payment" },
  { event: "refund", label: "Refund Notification", description: "Sent when a payment is refunded" },
  { event: "forgot_password", label: "Password Reset", description: "Sent when a user requests a password reset" },
  { event: "completion", label: "Course Completion", description: "Sent when a student completes a course" },
  { event: "affiliate_commission", label: "Affiliate Commission", description: "Sent when affiliate earns a commission" },
];

router.get("/automation", requireAdmin, async (_req, res): Promise<void> => {
  const rules = await db.select({
    id: emailAutomationRulesTable.id,
    event: emailAutomationRulesTable.event,
    templateId: emailAutomationRulesTable.templateId,
    isEnabled: emailAutomationRulesTable.isEnabled,
    delayMinutes: emailAutomationRulesTable.delayMinutes,
    updatedAt: emailAutomationRulesTable.updatedAt,
    templateName: emailTemplatesTable.name,
  }).from(emailAutomationRulesTable)
    .leftJoin(emailTemplatesTable, eq(emailAutomationRulesTable.templateId, emailTemplatesTable.id));

  const merged = AUTOMATION_EVENTS.map(ev => {
    const rule = rules.find(r => r.event === ev.event);
    return { ...ev, ...(rule ?? { id: null, isEnabled: false, templateId: null, delayMinutes: 0, templateName: null }) };
  });
  res.json(merged);
});

router.put("/automation/:event", requireAdmin, async (req, res): Promise<void> => {
  const { event } = req.params;
  const { templateId, isEnabled, delayMinutes } = req.body;
  const existing = await db.select().from(emailAutomationRulesTable).where(eq(emailAutomationRulesTable.event, event as any)).limit(1);
  if (existing.length > 0) {
    const [updated] = await db.update(emailAutomationRulesTable).set({
      templateId: templateId ?? null,
      isEnabled: !!isEnabled,
      delayMinutes: parseInt(String(delayMinutes)) || 0,
    }).where(eq(emailAutomationRulesTable.event, event as any)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(emailAutomationRulesTable).values({
      event: event as any,
      templateId: templateId ?? null,
      isEnabled: !!isEnabled,
      delayMinutes: parseInt(String(delayMinutes)) || 0,
    }).returning();
    res.json(created);
  }
});

/* ── Campaigns ── */
router.get("/campaigns", requireAdmin, async (_req, res): Promise<void> => {
  const campaigns = await db.select().from(emailCampaignsTable).orderBy(sql`${emailCampaignsTable.createdAt} desc`);
  res.json(campaigns);
});

router.post("/campaigns", requireAdmin, async (req, res): Promise<void> => {
  const { name, subject, templateId, htmlBody, recipientFilter } = req.body;
  if (!name || !subject || !htmlBody) { res.status(400).json({ error: "name, subject, htmlBody required" }); return; }

  let recipientCount = 0;
  const allUsers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.isBanned, false));
  if (recipientFilter === "enrolled") {
    const enrolled = await db.select({ userId: enrollmentsTable.userId }).from(enrollmentsTable);
    const enrolledIds = new Set(enrolled.map(e => e.userId));
    recipientCount = allUsers.filter(u => enrolledIds.has(u.id)).length;
  } else if (recipientFilter === "not_enrolled") {
    const enrolled = await db.select({ userId: enrollmentsTable.userId }).from(enrollmentsTable);
    const enrolledIds = new Set(enrolled.map(e => e.userId));
    recipientCount = allUsers.filter(u => !enrolledIds.has(u.id)).length;
  } else {
    recipientCount = allUsers.length;
  }

  const [campaign] = await db.insert(emailCampaignsTable).values({
    name, subject,
    templateId: templateId ? parseInt(String(templateId)) : null,
    htmlBody,
    recipientFilter: recipientFilter ?? "all",
    recipientCount,
    status: "draft",
  }).returning();
  res.status(201).json(campaign);
});

router.put("/campaigns/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, subject, htmlBody, recipientFilter } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (subject !== undefined) updates.subject = subject;
  if (htmlBody !== undefined) updates.htmlBody = htmlBody;
  if (recipientFilter !== undefined) updates.recipientFilter = recipientFilter;
  const [c] = await db.update(emailCampaignsTable).set(updates).where(eq(emailCampaignsTable.id, id)).returning();
  if (!c) { res.status(404).json({ error: "Not found" }); return; }
  res.json(c);
});

router.delete("/campaigns/:id", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(emailCampaignsTable).where(eq(emailCampaignsTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

router.post("/campaigns/:id/send", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [campaign] = await db.select().from(emailCampaignsTable).where(eq(emailCampaignsTable.id, id)).limit(1);
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  if (campaign.status === "sent") { res.status(400).json({ error: "Campaign already sent" }); return; }

  const smtp = await getSmtp();
  if (!smtp || !smtp.isActive) { res.status(400).json({ error: "SMTP not configured or inactive" }); return; }

  await db.update(emailCampaignsTable).set({ status: "sending" }).where(eq(emailCampaignsTable.id, id));
  res.json({ success: true, message: "Campaign is being sent in the background" });

  (async () => {
    try {
      let users: { id: number; email: string; name: string }[] = [];
      if (campaign.recipientFilter === "enrolled") {
        const enrolled = await db.select({ userId: enrollmentsTable.userId }).from(enrollmentsTable);
        const enrolledIds = enrolled.map(e => e.userId);
        if (enrolledIds.length > 0) {
          users = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
            .from(usersTable)
            .where(and(eq(usersTable.isBanned, false), sql`${usersTable.id} = ANY(${sql.raw(`ARRAY[${enrolledIds.join(",")}]`)})`));
        }
      } else if (campaign.recipientFilter === "not_enrolled") {
        const enrolled = await db.select({ userId: enrollmentsTable.userId }).from(enrollmentsTable);
        const enrolledIds = enrolled.map(e => e.userId);
        users = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
          .from(usersTable)
          .where(enrolledIds.length > 0
            ? and(eq(usersTable.isBanned, false), notInArray(usersTable.id, enrolledIds))
            : eq(usersTable.isBanned, false));
      } else {
        users = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
          .from(usersTable).where(eq(usersTable.isBanned, false));
      }

      const transporter = await createTransporter(smtp);
      let sentCount = 0;
      let failedCount = 0;

      for (const user of users) {
        let html = campaign.htmlBody.replaceAll("{{name}}", user.name).replaceAll("{{email}}", user.email);
        try {
          await transporter.sendMail({ from: buildFrom(smtp), to: user.email, subject: campaign.subject, html });
          await db.insert(emailSendsTable).values({ type: "campaign", campaignId: id, userId: user.id, email: user.email, subject: campaign.subject, status: "sent" });
          sentCount++;
        } catch (err: any) {
          await db.insert(emailSendsTable).values({ type: "campaign", campaignId: id, userId: user.id, email: user.email, subject: campaign.subject, status: "failed", failReason: String(err?.message ?? err) });
          failedCount++;
        }
        await new Promise(r => setTimeout(r, 100));
      }

      await db.update(emailCampaignsTable).set({ status: "sent", sentCount, failedCount, sentAt: new Date(), recipientCount: users.length }).where(eq(emailCampaignsTable.id, id));
    } catch (err: any) {
      await db.update(emailCampaignsTable).set({ status: "failed" }).where(eq(emailCampaignsTable.id, id));
    }
  })();
});

/* ── Subscribers ── */
router.get("/subscribers", requireAdmin, async (req, res): Promise<void> => {
  const { search, limit = "50", offset = "0" } = req.query as Record<string, string>;
  let query = db.select({
    id: usersTable.id, name: usersTable.name, email: usersTable.email,
    role: usersTable.role, isBanned: usersTable.isBanned, createdAt: usersTable.createdAt,
  }).from(usersTable).$dynamic();

  if (search) {
    const { ilike, or } = await import("drizzle-orm");
    query = query.where(or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.email, `%${search}%`))!);
  }

  const [users, totalResult] = await Promise.all([
    query.limit(parseInt(limit)).offset(parseInt(offset)),
    db.select({ count: count() }).from(usersTable),
  ]);
  res.json({ users, total: totalResult[0]?.count ?? 0 });
});

/* ── Dashboard Stats ── */
router.get("/stats", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalSubscribers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isBanned, false));
  const [sentThisMonth] = await db.select({ count: count() }).from(emailSendsTable)
    .where(sql`${emailSendsTable.sentAt} >= ${startOfMonth}`);
  const [totalCampaigns] = await db.select({ count: count() }).from(emailCampaignsTable).where(eq(emailCampaignsTable.status, "sent"));
  const [automationFired] = await db.select({ count: count() }).from(emailSendsTable).where(eq(emailSendsTable.type, "automation"));
  const [smtpRow] = await db.select({ isActive: smtpSettingsTable.isActive }).from(smtpSettingsTable).limit(1);

  res.json({
    totalSubscribers: totalSubscribers?.count ?? 0,
    sentThisMonth: sentThisMonth?.count ?? 0,
    campaignsSent: totalCampaigns?.count ?? 0,
    automationEmailsFired: automationFired?.count ?? 0,
    smtpConnected: smtpRow?.isActive ?? false,
  });
});

/* ── Send Log ── */
router.get("/sends", requireAdmin, async (req, res): Promise<void> => {
  const { limit = "50" } = req.query as Record<string, string>;
  const sends = await db.select().from(emailSendsTable)
    .orderBy(sql`${emailSendsTable.sentAt} desc`)
    .limit(parseInt(limit));
  res.json(sends);
});

export default router;

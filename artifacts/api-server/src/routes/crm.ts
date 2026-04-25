import { Router } from "express";
import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import {
  smtpSettingsTable, smtpAccountsTable, emailTemplatesTable, emailCampaignsTable,
  emailAutomationRulesTable, emailSendsTable, usersTable, enrollmentsTable,
  emailListsTable, emailListMembersTable,
  contactTagsTable, contactTagAssignmentsTable,
  emailSequencesTable, emailSequenceStepsTable, emailSequenceEnrollmentsTable,
  automationFunnelsTable, automationFunnelStepsTable,
} from "@workspace/db";
import { eq, count, sql, and, notInArray, inArray, asc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

/* ── helpers ── */
export async function getSmtp() {
  const [row] = await db.select().from(smtpSettingsTable).limit(1);
  return row ?? null;
}

export async function createTransporter(smtp: typeof smtpSettingsTable.$inferSelect) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.username, pass: smtp.password },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: { rejectUnauthorized: false, minVersion: "TLSv1.2" },
    ...(smtp.secure ? {} : { starttls: { enable: true } }),
  } as nodemailer.TransportOptions);
}

export function buildFrom(smtp: { fromName: string; fromEmail: string }) {
  return `"${smtp.fromName}" <${smtp.fromEmail}>`;
}

/** Try sending via a single account, return error message on failure */
async function trySend(account: { host: string; port: number; secure: boolean; username: string; password: string; fromName: string; fromEmail: string }, to: string, subject: string, html: string): Promise<string | null> {
  try {
    const transporter = nodemailer.createTransport({
      host: account.host, port: account.port, secure: account.secure,
      auth: { user: account.username, pass: account.password },
      connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 20000,
      tls: { rejectUnauthorized: false, minVersion: "TLSv1.2" },
      ...(account.secure ? {} : { starttls: { enable: true } }),
    } as nodemailer.TransportOptions);
    await transporter.sendMail({ from: buildFrom(account), to, subject, html });
    return null; // success
  } catch (err: any) {
    return err?.message ?? String(err);
  }
}

/** Send via primary SMTP, falling back to backup accounts in priority order if primary fails */
export async function sendEmailWithFallback(to: string, subject: string, html: string): Promise<void> {
  const primary = await getSmtp();
  if (primary?.isActive && primary.host) {
    const err = await trySend(primary, to, subject, html);
    if (!err) return; // sent OK
    console.warn("[SMTP] Primary failed, trying backups. Error:", err);
  }
  // Try backup accounts ordered by priority ascending (1 = highest priority)
  const backups = await db.select().from(smtpAccountsTable)
    .where(and(eq(smtpAccountsTable.isActive, true)))
    .orderBy(asc(smtpAccountsTable.priority));
  for (const backup of backups) {
    if (!backup.host) continue;
    const err = await trySend(backup, to, subject, html);
    if (!err) {
      await db.update(smtpAccountsTable).set({ lastError: null }).where(eq(smtpAccountsTable.id, backup.id)).catch(() => {});
      return; // sent OK via backup
    }
    console.warn(`[SMTP] Backup "${backup.name}" failed:`, err);
    await db.update(smtpAccountsTable).set({ lastError: err }).where(eq(smtpAccountsTable.id, backup.id)).catch(() => {});
  }
  throw new Error("All SMTP accounts failed");
}

/** Send a single transactional email directly via SMTP (bypasses CRM automations) */
export async function sendTransactionalEmail(to: string, subject: string, html: string): Promise<void> {
  const smtp = await getSmtp();
  if (!smtp || !smtp.isActive) return;
  await sendEmailWithFallback(to, subject, html);
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

    const send = async () => {
      try {
        await sendEmailWithFallback(email, subject, html);
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
  const { name, host, port, secure, username, password, fromName, fromEmail, isActive } = req.body;
  const existing = await getSmtp();
  const values: Record<string, unknown> = { name: name || "Primary SMTP", host, port: parseInt(String(port)) || 587, secure: !!secure, username, fromName, fromEmail, isActive: !!isActive };
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
  if (!smtp.password) { res.status(400).json({ error: "SMTP password not set — save your settings first" }); return; }
  const { to } = req.body;
  if (!to) { res.status(400).json({ error: "Recipient email required" }); return; }
  try {
    const transporter = await createTransporter(smtp);
    const info = await transporter.sendMail({
      from: buildFrom(smtp),
      to,
      subject: "VK Academy — SMTP Test",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;background:#0a0f1e;color:#e2e8f0;border-radius:12px;">
        <h2 style="color:#2563eb;">✅ SMTP Test Successful</h2>
        <p>Your SMTP configuration is working correctly.</p>
        <p style="color:#64748b;font-size:12px;">Sent from VK Academy CRM · Host: ${smtp.host}:${smtp.port}</p>
      </div>`,
    });
    console.log("[SMTP test] Sent OK — messageId:", info.messageId);
    await db.insert(emailSendsTable).values({ type: "test", email: to, subject: "VK Academy — SMTP Test", status: "sent" });
    res.json({ success: true, message: "Test email sent successfully" });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    console.error("[SMTP test] Failed —", msg, "| host:", smtp.host, "port:", smtp.port, "user:", smtp.username);
    await db.insert(emailSendsTable).values({ type: "test", email: to, subject: "VK Academy — SMTP Test", status: "failed", failReason: msg }).catch(() => {});
    res.status(500).json({ error: msg });
  }
});

/* ── Live SMTP test (uses form values, not saved DB settings) ── */
router.post("/smtp/test-live", requireAdmin, async (req, res): Promise<void> => {
  const { host, port, secure, username, password, fromName, fromEmail, to } = req.body;
  if (!to) { res.status(400).json({ error: "Recipient email required" }); return; }
  if (!host) { res.status(400).json({ error: "SMTP host required" }); return; }
  if (!username) { res.status(400).json({ error: "SMTP username required" }); return; }

  // If password omitted (leave-blank-to-keep), fall back to the stored DB password
  let resolvedPassword = password;
  if (!resolvedPassword) {
    const saved = await getSmtp();
    resolvedPassword = saved?.password ?? "";
  }
  if (!resolvedPassword) { res.status(400).json({ error: "Password required — enter a password or save settings first" }); return; }

  const cfg = {
    host, port: parseInt(String(port)) || 587, secure: !!secure,
    username, password: resolvedPassword,
    fromName: fromName || "VK Academy", fromEmail: fromEmail || username,
  } as typeof smtpSettingsTable.$inferSelect;

  try {
    const transporter = await createTransporter(cfg);
    const info = await transporter.sendMail({
      from: buildFrom(cfg),
      to,
      subject: "VK Academy — SMTP Live Test",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;background:#0a0f1e;color:#e2e8f0;border-radius:12px;">
        <h2 style="color:#2563eb;">✅ SMTP Live Test Successful</h2>
        <p>Your unsaved SMTP settings are working correctly.</p>
        <p style="color:#64748b;font-size:12px;">Host: ${host}:${port} · User: ${username}</p>
      </div>`,
    });
    console.log("[SMTP live-test] Sent OK — messageId:", info.messageId);
    await db.insert(emailSendsTable).values({ type: "test", email: to, subject: "VK Academy — SMTP Live Test", status: "sent" });
    res.json({ success: true, message: "Test email sent with current form settings" });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    console.error("[SMTP live-test] Failed —", msg, "| host:", host, "port:", port, "user:", username);
    await db.insert(emailSendsTable).values({ type: "test", email: to, subject: "VK Academy — SMTP Live Test", status: "failed", failReason: msg }).catch(() => {});
    res.status(500).json({ error: msg });
  }
});

/* ── SMTP Backup Accounts ── */
router.get("/smtp/accounts", requireAdmin, async (_req, res): Promise<void> => {
  const accounts = await db.select().from(smtpAccountsTable).orderBy(asc(smtpAccountsTable.priority));
  res.json(accounts.map(({ password: _pw, ...safe }) => ({ ...safe, passwordSet: !!_pw })));
});

router.post("/smtp/accounts", requireAdmin, async (req, res): Promise<void> => {
  const { name, host, port, secure, username, password, fromName, fromEmail, priority, isActive } = req.body;
  if (!host || !username || !password) { res.status(400).json({ error: "Host, username and password are required" }); return; }
  const [created] = await db.insert(smtpAccountsTable).values({
    name: name || "Backup SMTP",
    host, port: parseInt(String(port)) || 587,
    secure: !!secure, username, password,
    fromName: fromName || "VK Academy",
    fromEmail: fromEmail || username,
    priority: parseInt(String(priority)) || 1,
    isActive: isActive !== false,
  }).returning();
  const { password: _pw, ...safe } = created;
  res.json({ ...safe, passwordSet: true });
});

router.put("/smtp/accounts/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, host, port, secure, username, password, fromName, fromEmail, priority, isActive } = req.body;
  const values: Record<string, unknown> = {
    name, host, port: parseInt(String(port)) || 587,
    secure: !!secure, username,
    fromName, fromEmail,
    priority: parseInt(String(priority)) || 1,
    isActive: !!isActive,
  };
  if (password) values.password = password;
  const [updated] = await db.update(smtpAccountsTable).set(values).where(eq(smtpAccountsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Account not found" }); return; }
  const { password: _pw, ...safe } = updated;
  res.json({ ...safe, passwordSet: !!_pw });
});

router.delete("/smtp/accounts/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(smtpAccountsTable).where(eq(smtpAccountsTable.id, id));
  res.json({ success: true });
});

/* Promote a backup account to primary (swaps with current primary) */
router.post("/smtp/accounts/:id/promote", requireAdmin, async (req, res): Promise<void> => {
  const backupId = parseInt(req.params.id);
  const [backup] = await db.select().from(smtpAccountsTable).where(eq(smtpAccountsTable.id, backupId)).limit(1);
  if (!backup) { res.status(404).json({ error: "Account not found" }); return; }

  const primary = await getSmtp();

  // If there's a current primary with actual config, demote it to a backup account
  if (primary?.host) {
    await db.insert(smtpAccountsTable).values({
      name: primary.name || "Previous Primary",
      host: primary.host, port: primary.port, secure: primary.secure,
      username: primary.username, password: primary.password,
      fromName: primary.fromName, fromEmail: primary.fromEmail,
      priority: 1, isActive: true,
    });
  }

  // Promote the backup to primary
  const newPrimaryValues: Record<string, unknown> = {
    name: backup.name, host: backup.host, port: backup.port, secure: backup.secure,
    username: backup.username, password: backup.password,
    fromName: backup.fromName, fromEmail: backup.fromEmail,
    isActive: backup.isActive,
  };

  if (primary) {
    await db.update(smtpSettingsTable).set(newPrimaryValues).where(eq(smtpSettingsTable.id, primary.id));
  } else {
    await db.insert(smtpSettingsTable).values(newPrimaryValues as any);
  }

  // Remove the backup (it's now primary)
  await db.delete(smtpAccountsTable).where(eq(smtpAccountsTable.id, backupId));

  res.json({ success: true });
});

router.post("/smtp/accounts/:id/test", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { to } = req.body;
  if (!to) { res.status(400).json({ error: "Recipient email required" }); return; }
  const [account] = await db.select().from(smtpAccountsTable).where(eq(smtpAccountsTable.id, id)).limit(1);
  if (!account) { res.status(404).json({ error: "Account not found" }); return; }
  if (!account.password) { res.status(400).json({ error: "No password saved for this account" }); return; }
  const err = await trySend(account, to, `SMTP Test — ${account.name}`,
    `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;background:#0a0f1e;color:#e2e8f0;border-radius:12px;">
      <h2 style="color:#2563eb;">✅ Backup SMTP Test Successful</h2>
      <p>Your backup SMTP account <strong>${account.name}</strong> is working correctly.</p>
      <p style="color:#64748b;font-size:12px;">Host: ${account.host}:${account.port} · Priority: ${account.priority}</p>
    </div>`);
  if (err) {
    await db.update(smtpAccountsTable).set({ lastError: err }).where(eq(smtpAccountsTable.id, id));
    res.status(500).json({ error: err }); return;
  }
  await db.update(smtpAccountsTable).set({ lastError: null, lastTestedAt: new Date() }).where(eq(smtpAccountsTable.id, id));
  await db.insert(emailSendsTable).values({ type: "test", email: to, subject: `SMTP Test — ${account.name}`, status: "sent" });
  res.json({ success: true });
});

/* ── Template test-send ── */
const SAMPLE_VARIABLES: Record<string, string> = {
  name: "Rahul Sharma",
  email: "rahul.sharma@example.com",
  course_name: "Advanced React Masterclass",
  amount: "4,999.00",
  reset_link: "https://vkacademy.com/reset-password?token=sample_abc123",
  commission_amount: "999.80",
  payout_amount: "4,998.00",
  site_name: "VK Academy",
};

router.post("/templates/test-send", requireAdmin, async (req, res): Promise<void> => {
  const smtp = await getSmtp();
  if (!smtp || !smtp.host) { res.status(400).json({ error: "SMTP not configured. Go to the SMTP tab and save your settings first." }); return; }
  if (!smtp.isActive) { res.status(400).json({ error: "SMTP is not active. Enable it in the SMTP tab before sending." }); return; }
  const { to, subject, htmlBody } = req.body;
  if (!to) { res.status(400).json({ error: "Recipient email required" }); return; }
  if (!subject) { res.status(400).json({ error: "Subject required" }); return; }
  if (!htmlBody) { res.status(400).json({ error: "Email body required" }); return; }
  try {
    // Replace all variables with sample values so preview looks realistic
    let processedHtml = htmlBody;
    let processedSubject = subject;
    for (const [key, val] of Object.entries(SAMPLE_VARIABLES)) {
      processedHtml = processedHtml.replaceAll(`{{${key}}}`, val);
      processedSubject = processedSubject.replaceAll(`{{${key}}}`, val);
    }
    await sendEmailWithFallback(to, `[TEST] ${processedSubject}`, processedHtml);
    await db.insert(emailSendsTable).values({ type: "test", email: to, subject: `[TEST] ${processedSubject}`, status: "sent" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to send: ${err?.message ?? "Unknown error"}` });
  }
});

/* ── Templates ── */
router.get("/templates", requireAdmin, async (_req, res): Promise<void> => {
  const templates = await db.select().from(emailTemplatesTable).orderBy(emailTemplatesTable.createdAt);
  res.json(templates);
});

/* ── Shared email wrapper ── */
function emailWrap(body: string): string {
  const footer = `
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 0 8px;font-family:Arial,Helvetica,sans-serif;">
    <table cellpadding="0" cellspacing="0" style="margin-bottom:14px;"><tr>
      <td style="padding:0 5px;"><a href="#" style="text-decoration:none;display:inline-block;width:30px;height:30px;background:#e2e8f0;border-radius:5px;text-align:center;line-height:30px;font-size:13px;color:#475569;">𝕏</a></td>
      <td style="padding:0 5px;"><a href="#" style="text-decoration:none;display:inline-block;width:30px;height:30px;background:#e2e8f0;border-radius:5px;text-align:center;line-height:30px;font-size:12px;color:#475569;font-weight:700;">in</a></td>
      <td style="padding:0 5px;"><a href="#" style="text-decoration:none;display:inline-block;width:30px;height:30px;background:#e2e8f0;border-radius:5px;text-align:center;line-height:30px;font-size:13px;color:#475569;">▶</a></td>
      <td style="padding:0 5px;"><a href="#" style="text-decoration:none;display:inline-block;width:30px;height:30px;background:#e2e8f0;border-radius:5px;text-align:center;line-height:30px;font-size:13px;color:#475569;">◎</a></td>
    </tr></table>
    <p style="margin:0 0 3px;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">Sent by <strong>Vipul Kumar Academy</strong></p>
    <p style="margin:0 0 10px;font-size:11px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">
      <a href="mailto:support@vipulkumaracademy.com" style="color:#94a3b8;text-decoration:none;">support@vipulkumaracademy.com</a>
      &nbsp;·&nbsp; WhatsApp: <a href="https://wa.me/15557485582" style="color:#94a3b8;text-decoration:none;">+15557485582</a>
    </p>
    <a href="#" style="font-size:11px;color:#ef4444;text-decoration:none;">Unsubscribe</a>
  </td></tr></table>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="background:#ffffff;border-radius:16px;padding:36px 40px;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;">
    ${body}
  </td></tr>
  <tr><td>${footer}</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

const DEFAULT_TEMPLATES = [
  {
    name: "Welcome Email",
    type: "welcome" as const,
    subject: "Welcome to Vipul Kumar Academy, {{name}}! 🎉",
    htmlBody: emailWrap(`
      <p style="margin:0 0 6px;font-size:15px;color:#111827;line-height:1.5;">Hi <strong>{{name}}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Welcome to <strong>Vipul Kumar Academy</strong>! 🎉 We're thrilled to have you join India's premier business education platform.</p>
      <p style="margin:0 0 14px;font-size:15px;color:#374151;line-height:1.7;">Here's what you now have access to:</p>
      <ul style="margin:0 0 22px;padding-left:20px;color:#374151;font-size:14px;line-height:2.1;">
        <li>In-depth courses on <strong>Affiliate Marketing, E-commerce &amp; Dropshipping</strong></li>
        <li>Real-world case studies and step-by-step lessons</li>
        <li>Earn extra income by joining our <strong>Affiliate Program</strong></li>
        <li>Community support and mentorship resources</li>
      </ul>
      <p style="margin:0 0 10px;font-size:14px;color:#374151;">First, please verify your email to activate your account:</p>
      <table cellpadding="0" cellspacing="0" style="margin:16px 0 24px;">
        <tr><td style="background:#2563eb;border-radius:8px;padding:13px 30px;">
          <a href="{{verify_link}}" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Verify My Email &rarr;</a>
        </td></tr>
      </table>
      <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.7;">Once verified, browse our course catalog and take your first step toward financial independence.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;" />
      <p style="margin:0;font-size:14px;color:#6b7280;">Happy learning,<br><strong style="color:#374151;">The VKA Team</strong></p>
    `),
  },
  {
    name: "Purchase Confirmation",
    type: "purchase" as const,
    subject: "Payment Confirmed — {{course_name}} ✅",
    htmlBody: emailWrap(`
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
        <tr><td align="center" style="background:#f0fdf4;border-radius:12px;padding:20px;">
          <p style="margin:0 0 6px;font-size:36px;line-height:1;">✅</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#15803d;font-family:Arial,Helvetica,sans-serif;">Payment Confirmed!</h1>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Hi <strong>{{name}}</strong>, your payment was successful and your course access is now active.</p>
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;font-size:14px;font-family:Arial,Helvetica,sans-serif;">
        <tr style="background:#f9fafb;">
          <td style="padding:11px 16px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Course</td>
          <td style="padding:11px 16px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">{{course_name}}</td>
        </tr>
        <tr>
          <td style="padding:11px 16px;color:#6b7280;">Amount Paid</td>
          <td style="padding:11px 16px;color:#15803d;font-weight:700;text-align:right;">&#8377;{{amount}}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:11px 16px;color:#6b7280;border-top:1px solid #e5e7eb;">Account Email</td>
          <td style="padding:11px 16px;color:#374151;text-align:right;border-top:1px solid #e5e7eb;">{{email}}</td>
        </tr>
      </table>
      <p style="margin:0 0 18px;font-size:14px;color:#374151;line-height:1.7;">Your course is now available in your dashboard. Start learning immediately!</p>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td style="background:#16a34a;border-radius:8px;padding:13px 30px;">
          <a href="{{site_url}}/my-courses" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Start Learning &rarr;</a>
        </td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 16px;" />
      <p style="margin:0;font-size:13px;color:#6b7280;">Need help? Email us at <a href="mailto:support@vipulkumaracademy.com" style="color:#2563eb;text-decoration:none;">support@vipulkumaracademy.com</a> or WhatsApp us at <a href="https://wa.me/15557485582" style="color:#2563eb;text-decoration:none;">+15557485582</a></p>
    `),
  },
  {
    name: "Refund Notification",
    type: "refund" as const,
    subject: "Refund Processed — {{course_name}}",
    htmlBody: emailWrap(`
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
        <tr><td align="center" style="background:#fffbeb;border-radius:12px;padding:20px;">
          <p style="margin:0 0 6px;font-size:36px;line-height:1;">↩️</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#92400e;font-family:Arial,Helvetica,sans-serif;">Refund Processed</h1>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Hi <strong>{{name}}</strong>, we've successfully processed your refund request. Here are the details:</p>
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:22px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;font-size:14px;font-family:Arial,Helvetica,sans-serif;">
        <tr style="background:#f9fafb;">
          <td style="padding:11px 16px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Course</td>
          <td style="padding:11px 16px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb;">{{course_name}}</td>
        </tr>
        <tr>
          <td style="padding:11px 16px;color:#6b7280;">Refund Amount</td>
          <td style="padding:11px 16px;color:#b45309;font-weight:700;text-align:right;">&#8377;{{amount}}</td>
        </tr>
      </table>
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:22px;">
        <tr><td style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;">
          <p style="margin:0;font-size:13px;color:#92400e;font-family:Arial,Helvetica,sans-serif;">&#8987; Please allow <strong>5–7 business days</strong> for the refund to reflect in your original payment method.</p>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">We're sorry to see you go. If you faced any issue with the course or have feedback, we'd truly love to hear from you — our team is here to help.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 16px;" />
      <p style="margin:0;font-size:13px;color:#6b7280;">Questions? Reach us at <a href="mailto:support@vipulkumaracademy.com" style="color:#2563eb;text-decoration:none;">support@vipulkumaracademy.com</a> or WhatsApp: <a href="https://wa.me/15557485582" style="color:#2563eb;text-decoration:none;">+15557485582</a></p>
    `),
  },
  {
    name: "Password Reset",
    type: "forgot_password" as const,
    subject: "Reset Your Vipul Kumar Academy Password 🔐",
    htmlBody: emailWrap(`
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
        <tr><td align="center" style="background:#eff6ff;border-radius:12px;padding:20px;">
          <p style="margin:0 0 6px;font-size:36px;line-height:1;">🔐</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#1d4ed8;font-family:Arial,Helvetica,sans-serif;">Reset Your Password</h1>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Hi <strong>{{name}}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">We received a request to reset the password for your Vipul Kumar Academy account associated with <strong>{{email}}</strong>.</p>
      <p style="margin:0 0 18px;font-size:14px;color:#374151;">Click the button below to set a new password:</p>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td style="background:#2563eb;border-radius:8px;padding:13px 30px;">
          <a href="{{reset_link}}" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Reset Password &rarr;</a>
        </td></tr>
      </table>
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
        <tr><td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 16px;">
          <p style="margin:0;font-size:13px;color:#9a3412;font-family:Arial,Helvetica,sans-serif;">&#9888;&#65039; This link expires in <strong>1 hour</strong>. If you did not request a password reset, please ignore this email — your account is safe.</p>
        </td></tr>
      </table>
      <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Or copy and paste this URL into your browser:</p>
      <p style="margin:0 0 20px;font-size:12px;color:#2563eb;word-break:break-all;">{{reset_link}}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 16px;" />
      <p style="margin:0;font-size:13px;color:#6b7280;">Need help? Contact us at <a href="mailto:support@vipulkumaracademy.com" style="color:#2563eb;text-decoration:none;">support@vipulkumaracademy.com</a></p>
    `),
  },
  {
    name: "Course Completion",
    type: "completion" as const,
    subject: "🎓 Congratulations! You completed {{course_name}}",
    htmlBody: emailWrap(`
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
        <tr><td align="center" style="background:#faf5ff;border-radius:12px;padding:24px 20px;">
          <p style="margin:0 0 6px;font-size:48px;line-height:1;">🎓</p>
          <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;color:#7c3aed;font-family:Arial,Helvetica,sans-serif;">Course Complete!</h1>
        </td></tr>
      </table>
      <p style="margin:0 0 10px;font-size:15px;color:#374151;line-height:1.7;">Hi <strong>{{name}}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Congratulations! 🎉 You've successfully completed:</p>
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:22px;">
        <tr><td align="center" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:16px 20px;">
          <p style="margin:0;font-size:17px;font-weight:700;color:#4c1d95;font-family:Arial,Helvetica,sans-serif;">{{course_name}}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">You're now part of an elite group of learners who have mastered this curriculum. This is a huge achievement — be proud of yourself!</p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">Here's what you can do next:</p>
      <ul style="margin:0 0 22px;padding-left:20px;color:#374151;font-size:14px;line-height:2.1;">
        <li>Explore our other advanced courses</li>
        <li>Share your achievement on social media</li>
        <li>Join our Affiliate Program and earn commissions</li>
      </ul>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td style="background:#7c3aed;border-radius:8px;padding:13px 30px;">
          <a href="{{site_url}}/courses" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Explore More Courses &rarr;</a>
        </td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 16px;" />
      <p style="margin:0;font-size:13px;color:#6b7280;">Questions? Reach us at <a href="mailto:support@vipulkumaracademy.com" style="color:#2563eb;text-decoration:none;">support@vipulkumaracademy.com</a> or WhatsApp: <a href="https://wa.me/15557485582" style="color:#2563eb;text-decoration:none;">+15557485582</a></p>
    `),
  },
  {
    name: "Affiliate Commission",
    type: "affiliate_commission" as const,
    subject: "💰 Commission Earned — ₹{{payout_amount}}",
    htmlBody: emailWrap(`
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
        <tr><td align="center" style="background:#f0fdf4;border-radius:12px;padding:24px 20px;">
          <p style="margin:0 0 6px;font-size:48px;line-height:1;">💰</p>
          <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;color:#15803d;font-family:Arial,Helvetica,sans-serif;">Commission Credited!</h1>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Hi <strong>{{name}}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Great news! You've earned a new affiliate commission. Here's a summary:</p>
      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:22px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;font-size:14px;font-family:Arial,Helvetica,sans-serif;">
        <tr style="background:#f9fafb;">
          <td style="padding:11px 16px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Commission Amount</td>
          <td style="padding:11px 16px;color:#15803d;font-weight:700;text-align:right;font-size:16px;border-bottom:1px solid #e5e7eb;">&#8377;{{commission_amount}}</td>
        </tr>
        <tr>
          <td style="padding:11px 16px;color:#6b7280;">Payout Amount</td>
          <td style="padding:11px 16px;color:#15803d;font-weight:700;text-align:right;">&#8377;{{payout_amount}}</td>
        </tr>
      </table>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">The amount will be transferred to your registered bank account within <strong>2–3 business days</strong>. Keep sharing your affiliate link to earn more!</p>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td style="background:#16a34a;border-radius:8px;padding:13px 30px;">
          <a href="{{site_url}}/affiliate" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">View Affiliate Dashboard &rarr;</a>
        </td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 16px;" />
      <p style="margin:0;font-size:13px;color:#6b7280;">Questions? Email <a href="mailto:support@vipulkumaracademy.com" style="color:#2563eb;text-decoration:none;">support@vipulkumaracademy.com</a> or WhatsApp: <a href="https://wa.me/15557485582" style="color:#2563eb;text-decoration:none;">+15557485582</a></p>
    `),
  },
];

router.post("/templates/seed-defaults", requireAdmin, async (_req, res): Promise<void> => {
  const existing = await db.select({ id: emailTemplatesTable.id, type: emailTemplatesTable.type }).from(emailTemplatesTable);
  const existingByType = new Map(existing.map(e => [e.type, e.id]));

  let created = 0;
  let updated = 0;

  for (const t of DEFAULT_TEMPLATES) {
    const existingId = existingByType.get(t.type);
    if (existingId) {
      await db.update(emailTemplatesTable).set({ name: t.name, subject: t.subject, htmlBody: t.htmlBody, isActive: true }).where(eq(emailTemplatesTable.id, existingId));
      updated++;
    } else {
      await db.insert(emailTemplatesTable).values({ ...t, isActive: true });
      created++;
    }
  }

  res.json({ created, updated, message: `${created} created, ${updated} updated` });
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
  const { name, subject, templateId, htmlBody, recipientFilter, listId, tagId, scheduledAt } = req.body;
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
  } else if (recipientFilter === "list" && listId) {
    const members = await db.select({ userId: emailListMembersTable.userId }).from(emailListMembersTable).where(eq(emailListMembersTable.listId, parseInt(String(listId))));
    recipientCount = members.length;
  } else if (recipientFilter === "tag" && tagId) {
    const tagged = await db.select({ userId: contactTagAssignmentsTable.userId }).from(contactTagAssignmentsTable).where(eq(contactTagAssignmentsTable.tagId, parseInt(String(tagId))));
    recipientCount = tagged.length;
  } else {
    recipientCount = allUsers.length;
  }

  const status = scheduledAt ? "scheduled" : "draft";
  const [campaign] = await db.insert(emailCampaignsTable).values({
    name, subject,
    templateId: templateId ? parseInt(String(templateId)) : null,
    htmlBody,
    recipientFilter: recipientFilter ?? "all",
    recipientCount,
    listId: listId ? parseInt(String(listId)) : null,
    tagId: tagId ? parseInt(String(tagId)) : null,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    status,
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
      } else if (campaign.recipientFilter === "list" && campaign.listId) {
        const members = await db.select({ userId: emailListMembersTable.userId }).from(emailListMembersTable).where(eq(emailListMembersTable.listId, campaign.listId));
        const memberIds = members.map(m => m.userId);
        if (memberIds.length > 0) {
          users = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
            .from(usersTable).where(and(eq(usersTable.isBanned, false), inArray(usersTable.id, memberIds)));
        }
      } else if (campaign.recipientFilter === "tag" && campaign.tagId) {
        const tagged = await db.select({ userId: contactTagAssignmentsTable.userId }).from(contactTagAssignmentsTable).where(eq(contactTagAssignmentsTable.tagId, campaign.tagId));
        const taggedIds = tagged.map(t => t.userId);
        if (taggedIds.length > 0) {
          users = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
            .from(usersTable).where(and(eq(usersTable.isBanned, false), inArray(usersTable.id, taggedIds)));
        }
      } else {
        users = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
          .from(usersTable).where(eq(usersTable.isBanned, false));
      }

      let sentCount = 0;
      let failedCount = 0;

      for (const user of users) {
        let html = campaign.htmlBody.replaceAll("{{name}}", user.name).replaceAll("{{email}}", user.email);
        try {
          await sendEmailWithFallback(user.email, campaign.subject, html);
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
  const { search, limit = "50", offset = "0", tagId } = req.query as Record<string, string>;

  if (tagId) {
    const assignments = await db.select({ userId: contactTagAssignmentsTable.userId })
      .from(contactTagAssignmentsTable).where(eq(contactTagAssignmentsTable.tagId, parseInt(tagId)));
    const userIds = assignments.map(a => a.userId);
    if (userIds.length === 0) { res.json({ users: [], total: 0 }); return; }
    let users = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, isBanned: usersTable.isBanned, createdAt: usersTable.createdAt })
      .from(usersTable).where(inArray(usersTable.id, userIds));
    if (search) users = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
    const paginated = users.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    res.json({ users: paginated, total: users.length }); return;
  }

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

/* ──────────────── LISTS ──────────────── */

/* Get all lists with member counts */
router.get("/lists", requireAdmin, async (req, res): Promise<void> => {
  const lists = await db.select().from(emailListsTable).orderBy(emailListsTable.createdAt);
  const counts = await db
    .select({ listId: emailListMembersTable.listId, cnt: count() })
    .from(emailListMembersTable)
    .groupBy(emailListMembersTable.listId);
  const countMap: Record<number, number> = {};
  for (const r of counts) countMap[r.listId] = r.cnt;
  res.json(lists.map(l => ({ ...l, memberCount: countMap[l.id] ?? 0 })));
});

/* Create a list */
router.post("/lists", requireAdmin, async (req, res): Promise<void> => {
  const { name, description = "", type = "manual" } = req.body as { name: string; description?: string; type?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
  const [list] = await db.insert(emailListsTable).values({ name: name.trim(), description, type: type as any }).returning();
  res.json(list);
});

/* Delete a list (non-system only) */
router.delete("/lists/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [list] = await db.select().from(emailListsTable).where(eq(emailListsTable.id, id)).limit(1);
  if (!list) { res.status(404).json({ error: "Not found" }); return; }
  if (list.isSystem) { res.status(400).json({ error: "Cannot delete system lists" }); return; }
  await db.delete(emailListsTable).where(eq(emailListsTable.id, id));
  res.json({ ok: true });
});

/* Get members of a list */
router.get("/lists/:id/members", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const members = await db
    .select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      role: usersTable.role, subscribedAt: emailListMembersTable.subscribedAt,
    })
    .from(emailListMembersTable)
    .innerJoin(usersTable, eq(emailListMembersTable.userId, usersTable.id))
    .where(eq(emailListMembersTable.listId, id))
    .orderBy(sql`${emailListMembersTable.subscribedAt} desc`);
  res.json(members);
});

/* Add members to a list (by userId array) */
router.post("/lists/:id/members", requireAdmin, async (req, res): Promise<void> => {
  const listId = parseInt(req.params.id);
  const { userIds } = req.body as { userIds: number[] };
  if (!Array.isArray(userIds) || userIds.length === 0) { res.status(400).json({ error: "userIds required" }); return; }
  const rows = userIds.map(userId => ({ listId, userId }));
  await db.insert(emailListMembersTable).values(rows).onConflictDoNothing();
  res.json({ ok: true, added: rows.length });
});

/* Remove a member from a list */
router.delete("/lists/:id/members/:userId", requireAdmin, async (req, res): Promise<void> => {
  const listId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);
  await db.delete(emailListMembersTable).where(
    and(eq(emailListMembersTable.listId, listId), eq(emailListMembersTable.userId, userId))
  );
  res.json({ ok: true });
});

/* Sync a smart list (enrolled / all_subscribers) */
router.post("/lists/:id/sync", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [list] = await db.select().from(emailListsTable).where(eq(emailListsTable.id, id)).limit(1);
  if (!list) { res.status(404).json({ error: "Not found" }); return; }

  let userIds: number[] = [];
  if (list.type === "all_subscribers") {
    const users = await db.select({ id: usersTable.id }).from(usersTable);
    userIds = users.map(u => u.id);
  } else if (list.type === "enrolled") {
    const enrollments = await db.select({ userId: enrollmentsTable.userId }).from(enrollmentsTable);
    userIds = [...new Set(enrollments.map(e => e.userId))];
  } else {
    res.status(400).json({ error: "Only smart lists can be synced" }); return;
  }

  if (userIds.length > 0) {
    const rows = userIds.map(userId => ({ listId: id, userId }));
    await db.insert(emailListMembersTable).values(rows).onConflictDoNothing();
  }

  const [{ cnt }] = await db.select({ cnt: count() }).from(emailListMembersTable).where(eq(emailListMembersTable.listId, id));
  res.json({ ok: true, synced: userIds.length, total: cnt });
});

/* Search users not in a list (for adding members) */
router.get("/lists/:id/search-users", requireAdmin, async (req, res): Promise<void> => {
  const listId = parseInt(req.params.id);
  const { q = "" } = req.query as Record<string, string>;
  const existing = await db.select({ userId: emailListMembersTable.userId }).from(emailListMembersTable).where(eq(emailListMembersTable.listId, listId));
  const existingIds = existing.map(e => e.userId);
  const users = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(
      existingIds.length > 0
        ? and(sql`(${usersTable.name} ilike ${'%' + q + '%'} OR ${usersTable.email} ilike ${'%' + q + '%'})`, notInArray(usersTable.id, existingIds))
        : sql`(${usersTable.name} ilike ${'%' + q + '%'} OR ${usersTable.email} ilike ${'%' + q + '%'})`
    )
    .limit(20);
  res.json(users);
});

/* ──────────────── CONTACT TAGS ──────────────── */
router.get("/tags", requireAdmin, async (_req, res): Promise<void> => {
  const tags = await db.select().from(contactTagsTable).orderBy(asc(contactTagsTable.name));
  const counts = await db.select({ tagId: contactTagAssignmentsTable.tagId, cnt: count() })
    .from(contactTagAssignmentsTable).groupBy(contactTagAssignmentsTable.tagId);
  const countMap: Record<number, number> = {};
  for (const c of counts) countMap[c.tagId] = Number(c.cnt);
  res.json(tags.map(t => ({ ...t, subscriberCount: countMap[t.id] ?? 0 })));
});

router.post("/tags", requireAdmin, async (req, res): Promise<void> => {
  const { name, color, description } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [tag] = await db.insert(contactTagsTable).values({ name, color: color ?? "#6366f1", description: description ?? "" }).returning();
  res.status(201).json(tag);
});

router.put("/tags/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, color, description } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (color !== undefined) updates.color = color;
  if (description !== undefined) updates.description = description;
  const [tag] = await db.update(contactTagsTable).set(updates).where(eq(contactTagsTable.id, id)).returning();
  if (!tag) { res.status(404).json({ error: "Not found" }); return; }
  res.json(tag);
});

router.delete("/tags/:id", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(contactTagsTable).where(eq(contactTagsTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

router.get("/tags/:id/contacts", requireAdmin, async (req, res): Promise<void> => {
  const tagId = parseInt(req.params.id);
  const assignments = await db.select({ userId: contactTagAssignmentsTable.userId })
    .from(contactTagAssignmentsTable).where(eq(contactTagAssignmentsTable.tagId, tagId));
  const userIds = assignments.map(a => a.userId);
  if (userIds.length === 0) { res.json([]); return; }
  const users = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, createdAt: usersTable.createdAt })
    .from(usersTable).where(inArray(usersTable.id, userIds));
  res.json(users);
});

router.post("/tags/:id/contacts", requireAdmin, async (req, res): Promise<void> => {
  const tagId = parseInt(req.params.id);
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) { res.status(400).json({ error: "userIds array required" }); return; }
  await db.insert(contactTagAssignmentsTable).values(userIds.map((uid: number) => ({ tagId, userId: uid }))).onConflictDoNothing();
  res.json({ success: true });
});

router.delete("/tags/:tagId/contacts/:userId", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(contactTagAssignmentsTable)
    .where(and(eq(contactTagAssignmentsTable.tagId, parseInt(req.params.tagId)), eq(contactTagAssignmentsTable.userId, parseInt(req.params.userId))));
  res.json({ success: true });
});

/* ──────────────── CONTACT PROFILE ──────────────── */
router.get("/contacts/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  const [tags, emailHistory, listMemberships, enrollments] = await Promise.all([
    db.select({ id: contactTagsTable.id, name: contactTagsTable.name, color: contactTagsTable.color })
      .from(contactTagAssignmentsTable)
      .innerJoin(contactTagsTable, eq(contactTagAssignmentsTable.tagId, contactTagsTable.id))
      .where(eq(contactTagAssignmentsTable.userId, userId)),
    db.select().from(emailSendsTable).where(eq(emailSendsTable.userId, userId)).orderBy(sql`${emailSendsTable.sentAt} desc`).limit(20),
    db.select({ id: emailListsTable.id, name: emailListsTable.name, type: emailListsTable.type })
      .from(emailListMembersTable)
      .innerJoin(emailListsTable, eq(emailListMembersTable.listId, emailListsTable.id))
      .where(eq(emailListMembersTable.userId, userId)),
    db.select({ sequenceId: emailSequenceEnrollmentsTable.sequenceId, currentStep: emailSequenceEnrollmentsTable.currentStep, status: emailSequenceEnrollmentsTable.status, enrolledAt: emailSequenceEnrollmentsTable.enrolledAt })
      .from(emailSequenceEnrollmentsTable).where(eq(emailSequenceEnrollmentsTable.userId, userId)),
  ]);

  const { password: _pw, emailVerifyToken: _evt, passwordResetToken: _prt, ...safeUser } = user as any;
  res.json({ user: safeUser, tags, emailHistory, listMemberships, enrollments });
});

router.post("/contacts/:userId/tags", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  const { tagId } = req.body;
  if (!tagId) { res.status(400).json({ error: "tagId required" }); return; }
  await db.insert(contactTagAssignmentsTable).values({ tagId: parseInt(String(tagId)), userId }).onConflictDoNothing();
  res.json({ success: true });
});

router.delete("/contacts/:userId/tags/:tagId", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(contactTagAssignmentsTable)
    .where(and(eq(contactTagAssignmentsTable.userId, parseInt(req.params.userId)), eq(contactTagAssignmentsTable.tagId, parseInt(req.params.tagId))));
  res.json({ success: true });
});

/* ──────────────── EMAIL SEQUENCES ──────────────── */
router.get("/sequences", requireAdmin, async (_req, res): Promise<void> => {
  const sequences = await db.select().from(emailSequencesTable).orderBy(sql`${emailSequencesTable.createdAt} desc`);
  const stepCounts = await db.select({ sequenceId: emailSequenceStepsTable.sequenceId, cnt: count() })
    .from(emailSequenceStepsTable).groupBy(emailSequenceStepsTable.sequenceId);
  const enrollCounts = await db.select({ sequenceId: emailSequenceEnrollmentsTable.sequenceId, cnt: count() })
    .from(emailSequenceEnrollmentsTable).groupBy(emailSequenceEnrollmentsTable.sequenceId);
  const stepMap: Record<number, number> = {};
  const enrollMap: Record<number, number> = {};
  for (const s of stepCounts) stepMap[s.sequenceId] = Number(s.cnt);
  for (const e of enrollCounts) enrollMap[e.sequenceId] = Number(e.cnt);
  res.json(sequences.map(s => ({ ...s, stepCount: stepMap[s.id] ?? 0, enrolledCount: enrollMap[s.id] ?? 0 })));
});

router.post("/sequences", requireAdmin, async (req, res): Promise<void> => {
  const { name, description, trigger, triggerFilter } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [seq] = await db.insert(emailSequencesTable).values({ name, description: description ?? "", trigger: trigger ?? "manual", triggerFilter: triggerFilter ?? null }).returning();
  res.status(201).json(seq);
});

router.put("/sequences/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, description, trigger, triggerFilter, isActive } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (trigger !== undefined) updates.trigger = trigger;
  if (triggerFilter !== undefined) updates.triggerFilter = triggerFilter;
  if (isActive !== undefined) updates.isActive = isActive;
  const [seq] = await db.update(emailSequencesTable).set(updates).where(eq(emailSequencesTable.id, id)).returning();
  if (!seq) { res.status(404).json({ error: "Not found" }); return; }
  res.json(seq);
});

router.delete("/sequences/:id", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(emailSequencesTable).where(eq(emailSequencesTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

/* Sequence Steps */
router.get("/sequences/:id/steps", requireAdmin, async (req, res): Promise<void> => {
  const steps = await db.select().from(emailSequenceStepsTable)
    .where(eq(emailSequenceStepsTable.sequenceId, parseInt(req.params.id)))
    .orderBy(asc(emailSequenceStepsTable.stepOrder));
  res.json(steps);
});

router.post("/sequences/:id/steps", requireAdmin, async (req, res): Promise<void> => {
  const sequenceId = parseInt(req.params.id);
  const { subject, htmlBody, delayDays, stepOrder } = req.body;
  if (!subject) { res.status(400).json({ error: "subject required" }); return; }
  const existing = await db.select({ cnt: count() }).from(emailSequenceStepsTable).where(eq(emailSequenceStepsTable.sequenceId, sequenceId));
  const order = stepOrder ?? (Number(existing[0]?.cnt ?? 0) + 1);
  const [step] = await db.insert(emailSequenceStepsTable).values({ sequenceId, subject, htmlBody: htmlBody ?? "", delayDays: delayDays ?? 0, stepOrder: order }).returning();
  res.status(201).json(step);
});

router.put("/sequences/:id/steps/:stepId", requireAdmin, async (req, res): Promise<void> => {
  const stepId = parseInt(req.params.stepId);
  const { subject, htmlBody, delayDays, stepOrder } = req.body;
  const updates: Record<string, unknown> = {};
  if (subject !== undefined) updates.subject = subject;
  if (htmlBody !== undefined) updates.htmlBody = htmlBody;
  if (delayDays !== undefined) updates.delayDays = delayDays;
  if (stepOrder !== undefined) updates.stepOrder = stepOrder;
  const [step] = await db.update(emailSequenceStepsTable).set(updates).where(eq(emailSequenceStepsTable.id, stepId)).returning();
  if (!step) { res.status(404).json({ error: "Not found" }); return; }
  res.json(step);
});

router.delete("/sequences/:id/steps/:stepId", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(emailSequenceStepsTable).where(eq(emailSequenceStepsTable.id, parseInt(req.params.stepId)));
  res.json({ success: true });
});

/* Sequence Enrollments */
router.get("/sequences/:id/enrollments", requireAdmin, async (req, res): Promise<void> => {
  const seqId = parseInt(req.params.id);
  const enrollments = await db.select({
    id: emailSequenceEnrollmentsTable.id,
    userId: emailSequenceEnrollmentsTable.userId,
    currentStep: emailSequenceEnrollmentsTable.currentStep,
    status: emailSequenceEnrollmentsTable.status,
    enrolledAt: emailSequenceEnrollmentsTable.enrolledAt,
    completedAt: emailSequenceEnrollmentsTable.completedAt,
    nextSendAt: emailSequenceEnrollmentsTable.nextSendAt,
    userName: usersTable.name,
    userEmail: usersTable.email,
  }).from(emailSequenceEnrollmentsTable)
    .innerJoin(usersTable, eq(emailSequenceEnrollmentsTable.userId, usersTable.id))
    .where(eq(emailSequenceEnrollmentsTable.sequenceId, seqId))
    .orderBy(sql`${emailSequenceEnrollmentsTable.enrolledAt} desc`);
  res.json(enrollments);
});

router.post("/sequences/:id/enrollments", requireAdmin, async (req, res): Promise<void> => {
  const sequenceId = parseInt(req.params.id);
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) { res.status(400).json({ error: "userIds required" }); return; }

  const steps = await db.select().from(emailSequenceStepsTable)
    .where(eq(emailSequenceStepsTable.sequenceId, sequenceId))
    .orderBy(asc(emailSequenceStepsTable.stepOrder));

  const firstNextSend = steps.length > 0 ? new Date() : null;

  const rows = userIds.map((uid: number) => ({
    sequenceId, userId: uid, currentStep: 0, status: "active" as const,
    nextSendAt: firstNextSend,
  }));
  await db.insert(emailSequenceEnrollmentsTable).values(rows).onConflictDoNothing();
  res.json({ success: true, enrolled: userIds.length });
});

router.delete("/sequences/:id/enrollments/:userId", requireAdmin, async (req, res): Promise<void> => {
  await db.update(emailSequenceEnrollmentsTable)
    .set({ status: "cancelled" })
    .where(and(
      eq(emailSequenceEnrollmentsTable.sequenceId, parseInt(req.params.id)),
      eq(emailSequenceEnrollmentsTable.userId, parseInt(req.params.userId)),
    ));
  res.json({ success: true });
});

/* ──────────────── SEQUENCE PROCESSOR ──────────────── */
export async function processSequences(): Promise<void> {
  try {
    const smtp = await getSmtp();
    if (!smtp || !smtp.isActive) return;

    const now = new Date();
    const dueEnrollments = await db.select().from(emailSequenceEnrollmentsTable)
      .where(and(
        eq(emailSequenceEnrollmentsTable.status, "active"),
        sql`${emailSequenceEnrollmentsTable.nextSendAt} <= ${now}`,
      ));

    if (dueEnrollments.length === 0) return;

    for (const enrollment of dueEnrollments) {
      const steps = await db.select().from(emailSequenceStepsTable)
        .where(eq(emailSequenceStepsTable.sequenceId, enrollment.sequenceId))
        .orderBy(asc(emailSequenceStepsTable.stepOrder));

      const currentStepData = steps[enrollment.currentStep];
      if (!currentStepData) {
        await db.update(emailSequenceEnrollmentsTable).set({ status: "completed", completedAt: now }).where(eq(emailSequenceEnrollmentsTable.id, enrollment.id));
        continue;
      }

      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, enrollment.userId)).limit(1);
      if (!user) continue;

      let html = currentStepData.htmlBody.replaceAll("{{name}}", user.name).replaceAll("{{email}}", user.email);
      let subject = currentStepData.subject.replaceAll("{{name}}", user.name).replaceAll("{{email}}", user.email);

      try {
        await sendEmailWithFallback(user.email, subject, html);
        await db.insert(emailSendsTable).values({ type: "sequence", userId: user.id, email: user.email, subject, status: "sent" });
      } catch (err: any) {
        await db.insert(emailSendsTable).values({ type: "sequence", userId: user.id, email: user.email, subject, status: "failed", failReason: String(err?.message ?? err) });
      }

      const nextStepIndex = enrollment.currentStep + 1;
      if (nextStepIndex >= steps.length) {
        await db.update(emailSequenceEnrollmentsTable).set({ status: "completed", completedAt: now, currentStep: nextStepIndex, nextSendAt: null }).where(eq(emailSequenceEnrollmentsTable.id, enrollment.id));
      } else {
        const nextStep = steps[nextStepIndex];
        const nextSendAt = new Date(now.getTime() + (nextStep.delayDays * 24 * 60 * 60 * 1000));
        await db.update(emailSequenceEnrollmentsTable).set({ currentStep: nextStepIndex, nextSendAt }).where(eq(emailSequenceEnrollmentsTable.id, enrollment.id));
      }
    }
  } catch {
  }
}

/* Process scheduled campaigns */
export async function processScheduledCampaigns(): Promise<void> {
  try {
    const now = new Date();
    const scheduled = await db.select().from(emailCampaignsTable)
      .where(and(eq(emailCampaignsTable.status, "scheduled"), sql`${emailCampaignsTable.scheduledAt} <= ${now}`));
    for (const campaign of scheduled) {
      const smtp = await getSmtp();
      if (!smtp || !smtp.isActive) continue;
      await db.update(emailCampaignsTable).set({ status: "sending" }).where(eq(emailCampaignsTable.id, campaign.id));
      (async () => {
        try {
          let users: { id: number; email: string; name: string }[] = [];
          if (campaign.recipientFilter === "list" && campaign.listId) {
            const members = await db.select({ userId: emailListMembersTable.userId }).from(emailListMembersTable).where(eq(emailListMembersTable.listId, campaign.listId));
            const ids = members.map(m => m.userId);
            if (ids.length > 0) users = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name }).from(usersTable).where(and(eq(usersTable.isBanned, false), inArray(usersTable.id, ids)));
          } else {
            users = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name }).from(usersTable).where(eq(usersTable.isBanned, false));
          }
          let sentCount = 0; let failedCount = 0;
          for (const user of users) {
            const html = campaign.htmlBody.replaceAll("{{name}}", user.name).replaceAll("{{email}}", user.email);
            try {
              await sendEmailWithFallback(user.email, campaign.subject, html);
              await db.insert(emailSendsTable).values({ type: "campaign", campaignId: campaign.id, userId: user.id, email: user.email, subject: campaign.subject, status: "sent" });
              sentCount++;
            } catch (err: any) {
              await db.insert(emailSendsTable).values({ type: "campaign", campaignId: campaign.id, userId: user.id, email: user.email, subject: campaign.subject, status: "failed", failReason: String(err?.message ?? err) });
              failedCount++;
            }
            await new Promise(r => setTimeout(r, 100));
          }
          await db.update(emailCampaignsTable).set({ status: "sent", sentCount, failedCount, sentAt: new Date() }).where(eq(emailCampaignsTable.id, campaign.id));
        } catch {
          await db.update(emailCampaignsTable).set({ status: "failed" }).where(eq(emailCampaignsTable.id, campaign.id));
        }
      })();
    }
  } catch {
  }
}

router.post("/sequences/process", requireAdmin, async (_req, res): Promise<void> => {
  await processSequences();
  await processScheduledCampaigns();
  res.json({ success: true, message: "Processed sequences and scheduled campaigns" });
});

/* ══════════════════════════════ AUTOMATION FUNNELS ══════════════════════════════ */

router.get("/funnels", requireAdmin, async (_req, res): Promise<void> => {
  const funnels = await db.select().from(automationFunnelsTable).orderBy(asc(automationFunnelsTable.createdAt));
  const steps = await db.select().from(automationFunnelStepsTable).orderBy(asc(automationFunnelStepsTable.stepOrder));
  const result = funnels.map(f => ({
    ...f,
    steps: steps.filter(s => s.funnelId === f.id),
  }));
  res.json(result);
});

router.post("/funnels", requireAdmin, async (req, res): Promise<void> => {
  const { name, triggerType, triggerConfig } = req.body;
  if (!name || !triggerType) { res.status(400).json({ error: "name and triggerType required" }); return; }
  const [funnel] = await db.insert(automationFunnelsTable).values({ name, triggerType, triggerConfig: triggerConfig ?? {} }).returning();
  res.json({ ...funnel, steps: [] });
});

router.get("/funnels/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [funnel] = await db.select().from(automationFunnelsTable).where(eq(automationFunnelsTable.id, id)).limit(1);
  if (!funnel) { res.status(404).json({ error: "Funnel not found" }); return; }
  const steps = await db.select().from(automationFunnelStepsTable).where(eq(automationFunnelStepsTable.funnelId, id)).orderBy(asc(automationFunnelStepsTable.stepOrder));
  res.json({ ...funnel, steps });
});

router.put("/funnels/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, triggerType, triggerConfig, status, isActive } = req.body;

  const metaUpdates: Record<string, unknown> = {};
  if (name !== undefined) metaUpdates.name = name;
  if (triggerType !== undefined) metaUpdates.triggerType = triggerType;
  if (triggerConfig !== undefined) metaUpdates.triggerConfig = triggerConfig;
  if (status !== undefined) metaUpdates.status = status;
  if (isActive !== undefined) metaUpdates.isActive = Boolean(isActive);

  let updated: typeof automationFunnelsTable.$inferSelect | undefined;
  if (Object.keys(metaUpdates).length > 0) {
    const rows = await db.update(automationFunnelsTable).set(metaUpdates).where(eq(automationFunnelsTable.id, id)).returning();
    updated = rows[0];
  } else {
    const rows = await db.select().from(automationFunnelsTable).where(eq(automationFunnelsTable.id, id)).limit(1);
    updated = rows[0];
  }

  if (!updated) { res.status(404).json({ error: "Funnel not found" }); return; }
  const steps = await db.select().from(automationFunnelStepsTable).where(eq(automationFunnelStepsTable.funnelId, id)).orderBy(asc(automationFunnelStepsTable.stepOrder));
  res.json({ ...updated, steps });
});

router.delete("/funnels/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(automationFunnelsTable).where(eq(automationFunnelsTable.id, id));
  res.json({ success: true });
});

router.post("/funnels/:id/steps", requireAdmin, async (req, res): Promise<void> => {
  const funnelId = parseInt(req.params.id);
  const { actionType, config, insertAfterOrder } = req.body;
  if (!actionType) { res.status(400).json({ error: "actionType required" }); return; }

  // Shift existing steps after insertion point
  const insertOrder = typeof insertAfterOrder === "number" ? insertAfterOrder + 1 : 9999;
  await db.execute(sql`UPDATE automation_funnel_steps SET step_order = step_order + 1 WHERE funnel_id = ${funnelId} AND step_order >= ${insertOrder}`);

  const [step] = await db.insert(automationFunnelStepsTable).values({ funnelId, actionType, config: config ?? {}, stepOrder: insertOrder }).returning();
  res.json(step);
});

router.put("/funnels/:id/steps/:stepId", requireAdmin, async (req, res): Promise<void> => {
  const stepId = parseInt(req.params.stepId);
  const { actionType, config } = req.body;
  const updates: Record<string, unknown> = {};
  if (actionType !== undefined) updates.actionType = actionType;
  if (config !== undefined) updates.config = config;
  const [updated] = await db.update(automationFunnelStepsTable).set(updates).where(eq(automationFunnelStepsTable.id, stepId)).returning();
  if (!updated) { res.status(404).json({ error: "Step not found" }); return; }
  res.json(updated);
});

router.delete("/funnels/:id/steps/:stepId", requireAdmin, async (req, res): Promise<void> => {
  const stepId = parseInt(req.params.stepId);
  const funnelId = parseInt(req.params.id);
  const [removed] = await db.delete(automationFunnelStepsTable).where(eq(automationFunnelStepsTable.id, stepId)).returning();
  if (removed) {
    await db.execute(sql`UPDATE automation_funnel_steps SET step_order = step_order - 1 WHERE funnel_id = ${funnelId} AND step_order > ${removed.stepOrder}`);
  }
  res.json({ success: true });
});

/* Execute all published + active funnels for a given trigger + userId */
export async function triggerFunnel(triggerType: string, userId: number, triggerConfig: Record<string, unknown> = {}) {
  const funnels = await db.select().from(automationFunnelsTable)
    .where(and(
      eq(automationFunnelsTable.triggerType, triggerType),
      eq(automationFunnelsTable.status, "published"),
      eq(automationFunnelsTable.isActive, true),
    ));

  for (const funnel of funnels) {
    const cfg = funnel.triggerConfig as Record<string, unknown>;
    // For tag_applied / list_added, only fire if IDs match
    if (triggerType === "tag_applied" && cfg.tagId && cfg.tagId !== triggerConfig.tagId) continue;
    if (triggerType === "list_added" && cfg.listId && cfg.listId !== triggerConfig.listId) continue;

    const steps = await db.select().from(automationFunnelStepsTable)
      .where(eq(automationFunnelStepsTable.funnelId, funnel.id))
      .orderBy(asc(automationFunnelStepsTable.stepOrder));

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) continue;

    let cumulativeDelayMs = 0;
    for (const step of steps) {
      const config = step.config as Record<string, unknown>;
      if (step.actionType === "end") break;

      if (step.actionType === "wait") {
        const days = Number(config.days ?? 0);
        const hours = Number(config.hours ?? 0);
        cumulativeDelayMs += (days * 86400 + hours * 3600) * 1000;
        continue;
      }

      const execute = async () => {
        if (step.actionType === "apply_list" && config.listId) {
          const listId = Number(config.listId);
          const existing = await db.select().from(emailListMembersTable)
            .where(and(eq(emailListMembersTable.listId, listId), eq(emailListMembersTable.userId, userId))).limit(1);
          if (!existing.length) await db.insert(emailListMembersTable).values({ listId, userId });
        } else if (step.actionType === "remove_list" && config.listId) {
          const listId = Number(config.listId);
          await db.delete(emailListMembersTable).where(and(eq(emailListMembersTable.listId, listId), eq(emailListMembersTable.userId, userId)));
        } else if (step.actionType === "apply_tag" && config.tagId) {
          const tagId = Number(config.tagId);
          const existing = await db.select().from(contactTagAssignmentsTable)
            .where(and(eq(contactTagAssignmentsTable.tagId, tagId), eq(contactTagAssignmentsTable.userId, userId))).limit(1);
          if (!existing.length) await db.insert(contactTagAssignmentsTable).values({ tagId, userId });
        } else if (step.actionType === "remove_tag" && config.tagId) {
          const tagId = Number(config.tagId);
          await db.delete(contactTagAssignmentsTable).where(and(eq(contactTagAssignmentsTable.tagId, tagId), eq(contactTagAssignmentsTable.userId, userId)));
        } else if (step.actionType === "send_email") {
          let subject = String(config.subject ?? "");
          let html = String(config.body ?? "");
          if (config.mode === "template" && config.templateId) {
            const [tpl] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, Number(config.templateId))).limit(1);
            if (tpl) { subject = tpl.subject; html = tpl.htmlBody; }
          }
          subject = subject.replaceAll("{{name}}", user.name).replaceAll("{{email}}", user.email);
          html = html.replaceAll("{{name}}", user.name).replaceAll("{{email}}", user.email);
          try {
            await sendEmailWithFallback(user.email, subject, html);
            await db.insert(emailSendsTable).values({ type: "automation", automationEvent: triggerType, userId, email: user.email, subject, status: "sent" });
          } catch (err: any) {
            await db.insert(emailSendsTable).values({ type: "automation", automationEvent: triggerType, userId, email: user.email, subject, status: "failed", failReason: String(err?.message ?? err) });
          }
        }
      };

      if (cumulativeDelayMs > 0) {
        setTimeout(execute, cumulativeDelayMs);
      } else {
        await execute();
      }
    }
  }
}

export default router;

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

export function buildFrom(smtp: typeof smtpSettingsTable.$inferSelect) {
  return `"${smtp.fromName}" <${smtp.fromEmail}>`;
}

/** Send a single transactional email directly via SMTP (bypasses CRM automations) */
export async function sendTransactionalEmail(to: string, subject: string, html: string): Promise<void> {
  const smtp = await getSmtp();
  if (!smtp || !smtp.isActive) return;
  const transporter = await createTransporter(smtp);
  await transporter.sendMail({ from: buildFrom(smtp), to, subject, html });
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
    const transporter = await createTransporter(smtp);
    await transporter.sendMail({
      from: buildFrom(smtp),
      to,
      subject: `[TEST] ${processedSubject}`,
      html: processedHtml,
    });
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
  <tr><td align="center" style="padding-bottom:22px;">
    <a href="{{site_url}}" style="text-decoration:none;display:inline-block;background:#2563eb;border-radius:9px;padding:10px 24px;">
      <span style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:1.5px;">VIPUL KUMAR ACADEMY</span>
    </a>
  </td></tr>
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

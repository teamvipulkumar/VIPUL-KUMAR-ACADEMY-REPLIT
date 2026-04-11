import { Router } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";
import { triggerAutomation, sendTransactionalEmail } from "./crm";

const router = Router();

/* ── Build the HTML body for verification emails ── */
function buildVerificationEmailHtml(name: string, verifyLink: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:40px;box-sizing:border-box;">
<tr><td>
  <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Verify your email address</h1>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">Hi ${name},</p>
  <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#374151;">
    Thanks for signing up for <strong>Vipul Kumar Academy</strong>! Please verify your email address to activate your account.
  </p>
  <p style="text-align:center;margin:0 0 28px;">
    <a href="${verifyLink}" style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:600;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;">
      Verify My Email
    </a>
  </p>
  <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">Or copy and paste this link in your browser:</p>
  <p style="margin:0 0 28px;font-size:12px;color:#2563eb;word-break:break-all;">${verifyLink}</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;">
  <p style="margin:0;font-size:12px;color:#9ca3af;">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

router.post("/register", async (req, res): Promise<void> => {
  const { email, password, name, referralCode: referredBy } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: "email, password, and name are required" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  const referralCode = nanoid(8).toUpperCase();
  const verifyToken = nanoid(40);
  const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [user] = await db.insert(usersTable).values({
    email,
    password: hashed,
    name,
    referralCode,
    role: "student",
    emailVerified: false,
    emailVerifyToken: verifyToken,
    emailVerifyTokenExpiresAt: verifyExpiresAt,
  }).returning();

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
  const { password: _, emailVerifyToken: _vt, emailVerifyTokenExpiresAt: _vte, resetToken: _rt, resetTokenExpiresAt: _rte, ...safeUser } = user;
  res.status(201).json({ user: safeUser, message: "Registered successfully" });

  // Fire off both welcome automation and verification email (don't block response)
  const origin = (req.headers.origin as string) || process.env.SITE_URL || "";
  const verifyLink = `${origin}/verify-email?token=${verifyToken}`;
  triggerAutomation("welcome", user.id, user.email, { name: user.name, email: user.email, verify_link: verifyLink }).catch(() => {});
  sendTransactionalEmail(
    user.email,
    "Please verify your email — Vipul Kumar Academy",
    buildVerificationEmailHtml(user.name, verifyLink),
  ).catch(() => {});
});

router.post("/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (user.isBanned) {
    res.status(403).json({ error: "Account is banned" });
    return;
  }
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
  const { password: _, emailVerifyToken: _vt, emailVerifyTokenExpiresAt: _vte, resetToken: _rt, resetTokenExpiresAt: _rte, ...safeUser } = user;
  res.json({ user: safeUser, message: "Login successful" });
});

router.post("/logout", (req, res): void => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as Request & { user: JwtPayload }).user;
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId)).limit(1);
  if (!dbUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { password: _, emailVerifyToken: _vt, emailVerifyTokenExpiresAt: _vte, resetToken: _rt, resetTokenExpiresAt: _rte, ...safeUser } = dbUser;
  res.json(safeUser);
});

/* ── Verify email via token from link ── */
router.get("/verify-email", async (req, res): Promise<void> => {
  const { token } = req.query as { token?: string };
  if (!token) {
    res.status(400).json({ error: "Token is required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.emailVerifyToken, token)).limit(1);
  if (!user) {
    res.status(400).json({ error: "Invalid verification link" });
    return;
  }
  if (user.emailVerified) {
    res.json({ message: "Email already verified" });
    return;
  }
  if (!user.emailVerifyTokenExpiresAt || user.emailVerifyTokenExpiresAt < new Date()) {
    res.status(400).json({ error: "This verification link has expired. Please request a new one." });
    return;
  }
  await db.update(usersTable).set({
    emailVerified: true,
    emailVerifyToken: null,
    emailVerifyTokenExpiresAt: null,
  }).where(eq(usersTable.id, user.id));
  res.json({ message: "Email verified successfully! You can now access all features." });
});

/* ── Resend verification email (must be logged in) ── */
router.post("/resend-verify-email", requireAuth, async (req, res): Promise<void> => {
  const auth = (req as Request & { user: JwtPayload }).user;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, auth.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.emailVerified) {
    res.json({ message: "Your email is already verified." });
    return;
  }
  const verifyToken = nanoid(40);
  const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.update(usersTable).set({ emailVerifyToken: verifyToken, emailVerifyTokenExpiresAt: verifyExpiresAt }).where(eq(usersTable.id, user.id));

  const origin = (req.headers.origin as string) || process.env.SITE_URL || "";
  const verifyLink = `${origin}/verify-email?token=${verifyToken}`;
  sendTransactionalEmail(
    user.email,
    "Please verify your email — Vipul Kumar Academy",
    buildVerificationEmailHtml(user.name, verifyLink),
  ).catch(() => {});
  res.json({ message: "Verification email sent. Please check your inbox." });
});

router.post("/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (user) {
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.update(usersTable).set({ resetToken: token, resetTokenExpiresAt: expiresAt }).where(eq(usersTable.id, user.id));
    const origin = (req.headers.origin as string) || process.env.SITE_URL || "";
    const resetLink = `${origin}/reset-password?token=${token}`;
    triggerAutomation("forgot_password", user.id, user.email, { name: user.name, email: user.email, reset_link: resetLink }).catch(() => {});
  }
  res.json({ message: "If that email exists, a reset link has been sent" });
});

router.post("/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body;
  if (!token || !password) {
    res.status(400).json({ error: "token and password are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.resetToken, token)).limit(1);
  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  await db.update(usersTable).set({ password: hashed, resetToken: null, resetTokenExpiresAt: null }).where(eq(usersTable.id, user.id));
  res.json({ message: "Password reset successfully" });
});

export default router;

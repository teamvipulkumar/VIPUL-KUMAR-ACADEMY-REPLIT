import { Router } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth, type JwtPayload } from "../middlewares/auth";
import type { Request } from "express";

const router = Router();

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
  const [user] = await db.insert(usersTable).values({
    email,
    password: hashed,
    name,
    referralCode,
    role: "student",
  }).returning();
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
  const { password: _, ...safeUser } = user;
  res.status(201).json({ user: safeUser, message: "Registered successfully" });
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
  const { password: _, ...safeUser } = user;
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
  const { password: _, ...safeUser } = dbUser;
  res.json(safeUser);
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

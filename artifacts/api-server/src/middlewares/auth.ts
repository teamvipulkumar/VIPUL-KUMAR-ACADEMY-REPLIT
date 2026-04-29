import type { Request, Response, NextFunction, CookieOptions } from "express";
import jwt from "jsonwebtoken";

// SECURITY: fail loudly if the JWT secret is not configured. Previously we
// silently fell back to "dev-secret-change-in-production" which would let an
// attacker forge any user — including admin — if the env var ever dropped out
// of a deployment.
function loadJwtSecret(): string {
  const v = process.env.SESSION_SECRET;
  if (!v || v.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET is required in production and must be at least 16 chars.",
      );
    }
    // In dev, fall back to a random per-process secret so tokens don't survive
    // restarts and there is zero chance of a hardcoded secret leaking.
    return `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }
  return v;
}
const JWT_SECRET = loadJwtSecret();

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  isStaff?: boolean;
  staffPermissions?: Record<string, boolean> | null;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// SECURITY: single source of truth for cookie flags. `secure: true` in
// production prevents the cookie from being sent over plaintext HTTP.
// SameSite=lax prevents most CSRF (cross-origin XHR / form POSTs) while
// allowing top-level navigations (so links from emails still log users in).
export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export function clearAuthCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifyToken(token);
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const user = (req as Request & { user: JwtPayload }).user;
    if (user?.role !== "admin" && user?.role !== "staff") {
      res.status(403).json({ error: "Forbidden: admin only" });
      return;
    }
    next();
  });
}

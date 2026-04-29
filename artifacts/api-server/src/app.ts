import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authRateLimiter, paymentRateLimiter, generalRateLimiter } from "./middlewares/rate-limit";

const app: Express = express();

// SECURITY: Replit (and most production deployments) sit behind a reverse
// proxy that adds X-Forwarded-For. Trusting the first proxy hop lets
// express-rate-limit key on the real client IP instead of the proxy IP
// (otherwise every visitor would share one rate-limit bucket).
app.set("trust proxy", 1);

// ─── Security headers (helmet) ────────────────────────────────────────────────
// CSP intentionally loose because the frontend already serves its own HTML and
// loads third-party scripts (Stripe, Razorpay, Facebook Pixel). The API server
// only emits JSON + a couple of small HTML pages (unsubscribe). Disabling CSP
// here keeps payment gateway redirects working out-of-the-box.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ─── CORS allowlist ──────────────────────────────────────────────────────────
// SECURITY: Bug — `cors({ origin: true, credentials: true })` reflects ANY
// origin, which combined with cookie-based auth allows any malicious site to
// make authenticated requests. Now the allowlist is env-driven.
//
// In production: set `ALLOWED_ORIGINS=https://example.com,https://www.example.com`.
// In Replit dev: `REPLIT_DEV_DOMAIN` is auto-populated; we allow it.
// Same-origin requests (browser doesn't send Origin) bypass the check.
function buildAllowedOrigins(): Set<string> {
  const explicit = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const replitDev = process.env.REPLIT_DEV_DOMAIN;
  if (replitDev) explicit.push(`https://${replitDev}`, `http://${replitDev}`);
  const siteUrl = process.env.SITE_URL;
  if (siteUrl) explicit.push(siteUrl.replace(/\/+$/, ""));
  return new Set(explicit);
}
const ALLOWED_ORIGINS = buildAllowedOrigins();

function isOriginAllowed(origin: string | undefined | null): boolean {
  if (!origin) return true; // same-origin / non-browser
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    if (/\.(replit|repl)\.(dev|app|co)$/i.test(new URL(origin).hostname)) return true;
  } catch { /* malformed origin → reject */ }
  return false;
}

app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      // cb(null, false) → no CORS headers emitted; browser will block the
      // response. We avoid `cb(error)` because Express converts it into a 500
      // and the request still runs through subsequent middleware.
      cb(null, isOriginAllowed(origin));
    },
  }),
);

app.use(cookieParser());

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({
  limit: "20mb",
  verify: (req, _res, buf) => {
    // Capture raw body for webhook signature verification (Cashfree, Stripe, etc.)
    (req as { rawBody?: string }).rawBody = buf.toString("utf8");
  },
}));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// ─── CSRF defense (Origin/Referer check on state-changing requests) ──────────
// SECURITY: SameSite=lax cookies block most CSRF, but extension-issued or form
// POSTs can still slip through. We require the Origin/Referer header on
// non-GET requests to belong to the allowlist (or be same-origin). This is a
// pragmatic defense that doesn't require frontend token plumbing.
//
// Webhook bypass is an EXACT route allowlist (not a substring/suffix match) so
// future state-changing routes can never accidentally inherit the bypass by
// having the word "webhook" in their path. Each bypassed route MUST verify
// itself (signature/HMAC) — see /paytm/webhook and /paytm/callback handlers.
const CSRF_BYPASS_ROUTES = new Set([
  "/api/payments/cashfree/webhook",
  "/api/payments/razorpay/webhook",
  "/api/payments/stripe/webhook",
  "/api/payments/paytm/webhook",
  "/api/payments/paytm/callback",
]);

function safeOriginFromHeader(value: string | undefined): string | null {
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}

function safeHostnameFromOrigin(value: string): string | null {
  try { return new URL(value).hostname; } catch { return null; }
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const safe = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
  if (safe) return next();

  if (CSRF_BYPASS_ROUTES.has(req.path)) return next();

  const origin = req.headers.origin || safeOriginFromHeader(req.headers.referer as string | undefined);
  // No Origin/Referer → likely a non-browser API client (curl, mobile app).
  // We let these through; they need a valid JWT cookie anyway, and a CSRF
  // attack requires a victim browser.
  if (!origin) return next();

  if (ALLOWED_ORIGINS.has(origin)) return next();
  const host = safeHostnameFromOrigin(origin);
  if (host && /\.(replit|repl)\.(dev|app|co)$/i.test(host)) return next();

  res.status(403).json({ error: "CSRF: origin not allowed" });
});

// ─── Rate limiting ───────────────────────────────────────────────────────────
// SECURITY: prevents brute-force on auth + abuse of payment / coupon flows.
app.use("/api/auth/login", authRateLimiter);
app.use("/api/auth/register", authRateLimiter);
app.use("/api/auth/forgot-password", authRateLimiter);
app.use("/api/auth/reset-password", authRateLimiter);
app.use("/api/auth/google-login", authRateLimiter);
app.use("/api/payments", paymentRateLimiter);
app.use("/api/bundles", paymentRateLimiter);
app.use("/api/coupons/validate", generalRateLimiter);
app.use("/api/affiliate/track", generalRateLimiter);

// ─── Legacy uploads redirect ─────────────────────────────────────────────────
// Uploaded files now live in Supabase Storage (public bucket "uploads"). New
// uploads return absolute Supabase URLs directly, so no /api/files/* proxy is
// needed. Legacy DB rows pointing at /api/files/<name> are redirected here so
// any cached HTML keeps working until those rows are rewritten.
const SUPABASE_URL = process.env.SUPABASE_URL;
if (SUPABASE_URL) {
  app.get("/api/files/:filename", (req, res) => {
    const fn = String(req.params.filename ?? "");
    if (!fn || fn.includes("..") || fn.includes("/")) {
      res.status(400).send("Invalid filename"); return;
    }
    res.redirect(302, `${SUPABASE_URL}/storage/v1/object/public/uploads/${encodeURIComponent(fn)}`);
  });
}

app.use("/api", router);

export default app;

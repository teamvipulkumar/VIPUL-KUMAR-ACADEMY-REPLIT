import { Router, type IRouter } from "express";
import { timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { emailSendsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { signClickTarget, getPublicBaseUrl } from "./crm";

const router: IRouter = Router();

const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64",
);

function sendPixel(res: any) {
  res.set("Content-Type", "image/gif");
  res.set("Content-Length", String(PIXEL_GIF.length));
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.status(200).send(PIXEL_GIF);
}

/* ── Tracking pixel: marks email as opened ───────────────── */
router.get("/track/open/:token", async (req, res): Promise<void> => {
  try {
    const token = String(req.params.token ?? "");
    if (!token) { sendPixel(res); return; }

    await db.update(emailSendsTable)
      .set({
        openedAt: sql`COALESCE(${emailSendsTable.openedAt}, NOW())`,
        openCount: sql`${emailSendsTable.openCount} + 1`,
      })
      .where(eq(emailSendsTable.trackingToken, token));
  } catch (err) {
    console.warn("[email-tracking] open failed:", err);
  }
  sendPixel(res);
});

function safeFallbackHtml(title: string, message: string, status = 404) {
  return { status, html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0b1020;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{max-width:480px;width:100%;background:#111830;border:1px solid #1f2a44;border-radius:16px;padding:32px;text-align:center}h1{font-size:18px;margin:0 0 8px;color:#fff}p{font-size:14px;color:#94a3b8;margin:8px 0 0}</style></head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>` };
}

/* ── Click redirect: validates token + signature, records click, redirects ── */
router.get("/track/click/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  const to = String(req.query.to ?? "");
  const sig = String(req.query.sig ?? "");

  // Validate token first — never redirect on an invalid/unknown token.
  let sendId: number | null = null;
  if (token) {
    try {
      const [send] = await db.select({ id: emailSendsTable.id })
        .from(emailSendsTable).where(eq(emailSendsTable.trackingToken, token)).limit(1);
      if (send) sendId = send.id;
    } catch (err) {
      console.warn("[email-tracking] click lookup failed:", err);
    }
  }
  if (sendId == null) {
    const fb = safeFallbackHtml("Link no longer valid", "This link is invalid or has expired.");
    res.status(fb.status).set("Content-Type", "text/html; charset=utf-8").send(fb.html);
    return;
  }

  // Verify HMAC signature on `to` so that a recipient with a valid token can't
  // craft arbitrary phishing redirects bound to our domain.
  const expectedSig = signClickTarget(token, to);
  let sigOk = false;
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length === b.length) sigOk = timingSafeEqual(a, b);
  } catch { /* sigOk stays false */ }
  if (!sigOk) {
    const fb = safeFallbackHtml("Link not trusted", "This link's signature did not validate.");
    res.status(400).set("Content-Type", "text/html; charset=utf-8").send(fb.html);
    return;
  }

  // Resolve safe target URL.
  // - http(s) absolute URLs: allowed.
  // - root-relative paths ("/foo"): allowed; resolved against the public base.
  // - everything else (protocol-relative "//host", "javascript:", relative
  //   "foo/bar", empty): falls back to "/" on our domain.
  // Use the shared getPublicBaseUrl() so the click endpoint resolves to the
  // same domain (Admin Site URL → PUBLIC_BASE_URL → SITE_URL → REPLIT_DEV_DOMAIN)
  // that injectEmailTracking used when wrapping the link.
  const base = await getPublicBaseUrl();
  let target = base ? `${base}/` : "/";
  try {
    if (to.startsWith("/") && !to.startsWith("//")) {
      target = base ? `${base}${to}` : to;
    } else if (/^https?:\/\//i.test(to)) {
      const parsed = new URL(to);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        target = parsed.toString();
      }
    }
  } catch { /* keep default */ }

  // Record click (also marks an open since a click implies the email was opened)
  try {
    await db.update(emailSendsTable)
      .set({
        clickedAt: sql`COALESCE(${emailSendsTable.clickedAt}, NOW())`,
        clickCount: sql`${emailSendsTable.clickCount} + 1`,
        openedAt: sql`COALESCE(${emailSendsTable.openedAt}, NOW())`,
      })
      .where(eq(emailSendsTable.id, sendId));
  } catch (err) {
    console.warn("[email-tracking] click update failed:", err);
  }

  res.redirect(302, target);
});

/* ── Unsubscribe: marks user as opted-out ────────────────── */
router.get("/unsubscribe/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  let confirmed = false;
  let email = "";

  if (token) {
    try {
      const [send] = await db.select({
        id: emailSendsTable.id,
        userId: emailSendsTable.userId,
        email: emailSendsTable.email,
      }).from(emailSendsTable).where(eq(emailSendsTable.trackingToken, token)).limit(1);

      if (send) {
        email = send.email ?? "";
        await db.update(emailSendsTable)
          .set({ unsubscribedAt: sql`COALESCE(${emailSendsTable.unsubscribedAt}, NOW())` })
          .where(eq(emailSendsTable.id, send.id));

        if (send.userId) {
          await db.update(usersTable)
            .set({ emailUnsubscribedAt: sql`COALESCE(${usersTable.emailUnsubscribedAt}, NOW())` })
            .where(eq(usersTable.id, send.userId));
        }
        confirmed = true;
      }
    } catch (err) {
      console.warn("[email-tracking] unsubscribe failed:", err);
    }
  }

  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Unsubscribed</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0b1020;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{max-width:480px;width:100%;background:#111830;border:1px solid #1f2a44;border-radius:16px;padding:32px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.3)}
  .icon{width:56px;height:56px;border-radius:50%;background:${confirmed ? "#10b98122" : "#ef444422"};color:${confirmed ? "#10b981" : "#ef4444"};display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:16px}
  h1{font-size:20px;margin:0 0 8px;color:#fff}
  p{font-size:14px;line-height:1.6;color:#94a3b8;margin:8px 0 0}
  .email{color:#cbd5e1;font-weight:600}
</style></head>
<body><div class="card">
  <div class="icon">${confirmed ? "✓" : "!"}</div>
  <h1>${confirmed ? "You've been unsubscribed" : "Unsubscribe link is invalid"}</h1>
  <p>${confirmed
    ? `We've removed <span class="email">${email.replace(/[<>&"']/g, "")}</span> from our mailing list. You won't receive any more emails from us.`
    : "This unsubscribe link is no longer valid. If you continue to receive unwanted emails, please contact support."}</p>
</div></body></html>`);
});

export default router;

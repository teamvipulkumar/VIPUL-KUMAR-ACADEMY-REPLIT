# Railway Production Deployment — Vipul Kumar Academy

## Architecture on Railway

One Railway service runs everything:

```
Railway Service (single)
├── Express API  →  /api/*
└── React SPA    →  /* (static files served by Express in production)
```

The frontend makes all API calls to relative `/api/...` paths (same origin),
so both must run on the same domain. Express serves the pre-built Vite SPA
in production via `express.static()`.

---

## Step 1 — Connect GitHub Repo to Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select `teamvipulkumar/VIPUL-KUMAR-ACADEMY-REPLIT`
3. Railway detects `railway.json` + `nixpacks.toml` automatically — no manual config needed

---

## Step 2 — Set Environment Variables

In Railway → your service → **Variables**, add these **exactly**:

### 🔴 Required (app crashes without these)

| Variable | Value | Where to find it |
|---|---|---|
| `NODE_ENV` | `production` | hardcode this |
| `SUPABASE_DATABASE_URL` | `postgresql://postgres.xxxx:password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres` | Supabase → Project Settings → Database → **Transaction mode** (port **6543**, NOT 5432) |
| `SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Supabase → Project Settings → API → **service_role** key |
| `SESSION_SECRET` | 64-char random string | Generate: `openssl rand -hex 32` |

### 🟡 Required after first deploy (need your Railway URL first)

| Variable | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://your-app.up.railway.app` |
| `SITE_URL` | `https://your-app.up.railway.app` |

> After Railway assigns you a domain (or you set a custom domain), come back and add these two.
> Without them CORS still works for same-origin requests, but cross-origin flows (webhooks, mobile) may fail.

### 🟢 Optional

| Variable | Value | Purpose |
|---|---|---|
| `FACEBOOK_CAPI_ACCESS_TOKEN` | `EAAx...` | Meta Conversions API (server-side events) |
| `PUBLIC_BASE_URL` | `https://your-app.up.railway.app` | Override base URL in outgoing emails |
| `LOG_LEVEL` | `info` | Pino log level (debug/info/warn/error) |

### ❌ Do NOT set these on Railway (Replit-specific, ignored in production)
- `REPLIT_DEV_DOMAIN`
- `REPLIT_DOMAINS`
- `REPL_ID`
- `BASE_PATH` (only needed at Vite build time, handled by nixpacks.toml)

---

## Step 3 — Configure via Admin Panel (NOT env vars)

These are stored in the database — configure them in the admin panel after deploy:

| Feature | Where to configure |
|---|---|
| **Payment Gateways** (Razorpay, Stripe, Cashfree, Paytm) | Admin → Settings → Payment Gateways |
| **Google OAuth** (client_id + secret) | Admin → Settings → Google Sign-In |
| **SMTP / Email** | Admin → Settings → Email / SMTP |
| **Facebook Pixel** (pixel ID) | Admin → Settings → Pixel |
| **Branding** (logo, colors, site name) | Admin → Settings → Branding |

---

## Step 4 — First Admin Account

After deploy, go to your Railway URL → `/auth/register` → sign up normally.

Then in **Supabase Dashboard → Table Editor → `users` table**, find your email row and set:
- `role` → `admin`

Then log in — you'll land on the admin dashboard.

---

## Build Process (what nixpacks.toml does)

```
1. Install Node.js 22 + pnpm 10
2. pnpm install --frozen-lockfile          (installs all workspace deps)
3. PORT=3000 BASE_PATH=/ vite build        (builds React SPA → artifacts/course-platform/dist/public/)
4. node build.mjs (esbuild)                (bundles Express API → artifacts/api-server/dist/index.mjs)
5. node --enable-source-maps artifacts/api-server/dist/index.mjs  (start)
```

**Build time estimate:** ~3–5 minutes on first build, ~1–2 minutes on subsequent builds.

---

## Health Check

Railway uses `/api/healthz` to verify the service is up. Returns `{"status":"ok"}`.

---

## Background Jobs (auto-run inside the process)

No separate worker needed. These run inside the main process on timers:

| Job | Frequency | Purpose |
|---|---|---|
| Automation funnels + CRM campaigns | Every 10 min | Drip sequences, email campaigns |
| Email log cleanup | Every 6 hours | Delete old logs per retention setting |
| Creator payout cycle | Every 1 hour | Auto-pays creators on Saturdays (IST) |
| DB migrations | On startup | Idempotent schema updates |

---

## Custom Domain

Railway → your service → **Settings** → **Domains** → **Add Custom Domain**

After adding your domain, update:
- `ALLOWED_ORIGINS` → `https://yourdomain.com`
- `SITE_URL` → `https://yourdomain.com`

---

## Supabase Storage Setup

Before first deploy, ensure the `uploads` bucket exists in Supabase:

1. Supabase Dashboard → **Storage** → **New bucket**
2. Name: `uploads`
3. Public: ✅ (checked — files need to be publicly readable)
4. File size limit: `50MB` (or your preference)

---

## Scaling

Railway auto-scales within your plan. The app is stateless (JWT cookies, no in-memory sessions), so horizontal scaling works without any changes.

For high traffic, consider:
- Supabase connection pooling is already enabled via port 6543 (Transaction mode)
- Add `DATABASE_POOL_MAX=10` env var if you see connection limit errors

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `SUPABASE_DATABASE_URL must be set` | Missing env var | Add it in Railway Variables |
| `SESSION_SECRET is required in production` | Missing or < 16 chars | Generate with `openssl rand -hex 32` |
| `SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set` | Missing storage vars | Add both in Railway Variables |
| CORS errors in browser | Missing `ALLOWED_ORIGINS` | Add your Railway domain to it |
| 401 on all requests after deploy | Cookie `secure` flag requires HTTPS | Railway always uses HTTPS — ensure you're accessing via `https://` |
| White screen / 404 on page refresh | Static files not found | Ensure build succeeded: check Railway build logs |

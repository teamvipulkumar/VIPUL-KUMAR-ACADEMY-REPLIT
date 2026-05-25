# Railway Production Deployment — Vipul Kumar Academy

## Verified Build Results (locally tested)

```
✅ pnpm install --frozen-lockfile   → Done in 3.4s
✅ Vite build (React SPA)           → 3010 modules, dist/public/index.html
✅ esbuild (Express API)            → dist/index.mjs
✅ GET /api/healthz                 → {"status":"ok"}
✅ GET /                            → HTTP 200 (React SPA index.html)
✅ GET /admin                       → HTTP 200 (SPA fallback)
✅ GET /api/courses                 → HTTP 200 (live DB query)
```

---

## Architecture (ONE Service)

```
Railway Service
├── Build: pnpm install → Vite SPA build → esbuild API build
└── Run:   node artifacts/api-server/dist/index.mjs
               │
               ├── /api/*   → Express routes (DB, auth, uploads…)
               └── /*       → React SPA (express.static + index.html fallback)
```

The frontend uses relative `/api/...` paths — same domain, no CORS config needed
between frontend and backend.

---

## Files Already in the Repo (ready to deploy)

| File | Purpose |
|---|---|
| `railway.json` | Builder = NIXPACKS, healthcheck at `/api/healthz`, restart policy |
| `nixpacks.toml` | Node 22 via nix, build commands, start command |
| `package.json` | `"packageManager": "pnpm@10.26.1"` — nixpacks uses corepack (no PATH issues) |
| `artifacts/api-server/src/app.ts` | Serves `artifacts/course-platform/dist/public/` as static in production |

---

## Step 1 — Create Railway Service

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select your repo (`VIPUL-KUMAR-ACADEMY-REPLIT`)
3. Railway auto-detects `railway.json` + `nixpacks.toml` — **no manual config needed**

---

## Step 2 — Set Environment Variables

Railway → your service → **Variables** tab. Add these:

### 🔴 Required before first deploy

| Variable | Value | How to get it |
|---|---|---|
| `NODE_ENV` | `production` | Hardcode |
| `SUPABASE_DATABASE_URL` | `postgresql://postgres.xxxx:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres` | Supabase → Settings → Database → **Transaction mode, port 6543** |
| `SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...long key...` | Supabase → Settings → API → **service_role** (keep secret) |
| `SESSION_SECRET` | 64-char random string | Run locally: `openssl rand -hex 32` |

### 🟡 Required after first deploy (add your Railway domain)

| Variable | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://your-app.up.railway.app` |
| `SITE_URL` | `https://your-app.up.railway.app` |

> These enable CORS for webhook callbacks and set the base URL in outgoing emails.
> Same-origin requests work without them, so the app loads fine without these — add them after you see your domain.

### 🟢 Optional

| Variable | Value | Purpose |
|---|---|---|
| `FACEBOOK_CAPI_ACCESS_TOKEN` | `EAAx...` | Meta server-side events |
| `LOG_LEVEL` | `warn` | Reduce Railway log volume in prod |

---

## Step 3 — Supabase Storage Bucket

Before first deploy, create the uploads bucket:

1. Supabase → **Storage** → **New bucket**
2. Name: `uploads`
3. Public: ✅ **Yes** (files must be publicly readable)
4. File size limit: `50 MB`

---

## Step 4 — First Admin Account

1. Visit `https://your-app.up.railway.app/auth/register`
2. Register normally
3. Open **Supabase → Table Editor → `users` table**
4. Find your row → set `role` = `admin` → Save
5. Log in → you'll land on the admin dashboard

---

## What the nixpacks.toml Does (explained)

```toml
[phases.setup]
nixPkgs = ["nodejs_22"]          # Node 22 from nix — no npm install -g needed

# [phases.install] — omitted on purpose
# nixpacks auto-detects pnpm-lock.yaml + "packageManager" in package.json
# → runs: corepack enable && pnpm install --frozen-lockfile
# This avoids the $NIXPACKS_PATH and exit-code-127 errors

[phases.build]
cmds = [
  "PORT=3000 BASE_PATH=/ pnpm --filter @workspace/course-platform run build",
  "pnpm --filter @workspace/api-server run build"
]

[start]
cmd = "node --enable-source-maps artifacts/api-server/dist/index.mjs"
```

### Why the old nixpacks.toml failed

| Error | Cause | Fix applied |
|---|---|---|
| `UndefinedVar: $NIXPACKS_PATH` | `npm install -g pnpm` in `[phases.install]` generates a nix derivation that references `$NIXPACKS_PATH`, which isn't defined | Removed the install phase entirely — nixpacks auto-detects pnpm via `packageManager` field |
| `pnpm: exit code 127` | pnpm wasn't on PATH because `npm install -g` runs in a separate shell context | `packageManager: "pnpm@10.26.1"` in package.json makes nixpacks use Node's built-in corepack, which properly shims the binary |
| `PathError: Missing parameter name at index 1: *` | Express 5 no longer accepts `"*"` as a wildcard route | Fixed to `"/{*path}"` (Express 5 syntax) |

---

## Configure via Admin Panel (no env vars needed)

After deploying, configure these through the admin UI — they're stored in the DB:

| Feature | Admin Panel Location |
|---|---|
| Razorpay / Stripe / Cashfree / Paytm keys | Settings → Payment Gateways |
| Google OAuth (client_id + secret) | Settings → Google Sign-In |
| SMTP / Email sender | Settings → Email |
| Facebook Pixel ID | Settings → Pixel |
| Branding (logo, colors, site name) | Settings → Branding |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails: `SUPABASE_DATABASE_URL must be set` | Add it in Railway Variables before deploying |
| Build fails: `SESSION_SECRET is required in production` | Add it — generate with `openssl rand -hex 32` |
| White screen on page load | Check Railway build logs — Vite build must succeed |
| `/admin` 404 after deploy | Shouldn't happen with the SPA fallback, but check Node 22 is being used |
| Cookies not sent | Railway is HTTPS-only — cookies with `secure: true` work fine on Railway |
| Connection pool errors | Add `DATABASE_POOL_MAX=5` — Supabase free tier has a 60-connection limit |

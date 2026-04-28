# EduPro — Online Course Platform

## Overview

A full-stack SaaS course-selling platform with dark/blue premium theme. Built on a pnpm monorepo.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend**: React + Vite (artifacts/course-platform) — Wouter router, TanStack Query, Tailwind CSS, shadcn/ui
- **API**: Express 5 (artifacts/api-server) — JWT auth via httpOnly cookies, Pino logging
- **Database**: Supabase PostgreSQL + Drizzle ORM (lib/db) — uses `SUPABASE_DATABASE_URL` only. Built-in Replit Postgres (`DATABASE_URL`) is intentionally **not** used; the code throws if `SUPABASE_DATABASE_URL` is missing.
- **File storage**: Supabase Storage public bucket `uploads` — uploads stream straight from memory (no local disk). Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Helper at `artifacts/api-server/src/lib/supabase-storage.ts`.
- **API codegen**: Orval — generates React Query hooks from OpenAPI spec (lib/api-spec → lib/api-client-react)
- **Validation**: Zod (zod/v4), drizzle-zod

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — run API server (port 8080)
- `pnpm --filter @workspace/course-platform run dev` — run frontend (port auto via $PORT)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes

## Credentials (Dev/Seed)

- Admin: admin@edupro.com / Admin@12345
- Student: alice@edupro.com / Student@12345
- Affiliate: bob@edupro.com / Student@12345

## Frontend Pages

| Route | Description | Auth |
|---|---|---|
| `/` | Landing page (hero, stats, courses, features, testimonials) | Public |
| `/login` | Login form | Public |
| `/register` | Register with referral code support | Public |
| `/forgot-password` | Password reset request | Public |
| `/courses` | Course catalog with search & category filter | Public |
| `/courses/:id` | Course detail — curriculum, Stripe/Razorpay gateway, coupon codes | Public |
| `/dashboard` | Student overview — stats, enrolled courses, referral code | Auth |
| `/my-courses` | All enrolled courses with progress | Auth |
| `/learn/:courseId` | Lesson player — sidebar navigation, mark complete, prev/next | Auth |
| `/affiliate` | Affiliate dashboard — referral link, earnings, payout request | Auth |
| `/payments` | Payment history | Auth |
| `/notifications` | Notification center | Auth |
| `/admin` | Admin analytics dashboard with revenue chart | Admin |
| `/admin/courses` | Course CRUD | Admin |
| `/admin/courses/:id/edit` | Module & lesson editor | Admin |
| `/admin/users` | User management with ban/unban | Admin |
| `/admin/affiliates` | Affiliate overview | Admin |
| `/admin/payouts` | Payout request approval | Admin |
| `/admin/coupons` | Coupon code management | Admin |
| `/admin/settings` | Platform settings (commission rate, gateways, notifications) | Admin |

## API Routes (api-server port 8080)

- `/api/auth/*` — login, register, logout, me, forgot-password, reset-password
- `/api/courses/*` — CRUD, modules, lessons, lesson completion
- `/api/enrollments/*` — my enrollments, course progress
- `/api/payments/*` — checkout, verify
- `/api/affiliates/*` — dashboard, referrals, payout requests, tracking
- `/api/admin/*` — users, analytics, revenue, affiliates, payouts, courses, settings
- `/api/coupons/*` — list, create, validate, delete
- `/api/notifications/*` — list, mark read, mark all read
- `/api/analytics/*` — summary, recent activity

## DB Schema (lib/db/src/schema/)

Tables: users, courses, modules, lessons, enrollments, payments, affiliates (referrals + payouts), coupons, notifications, platform_settings, smtp_settings, smtp_accounts, email_lists, email_list_members, contact_tags, contact_tag_assignments, email_campaigns, email_automation_rules, email_sequences, email_sequence_steps, email_sequence_enrollments, email_sends, email_templates, **automation_funnels, automation_funnel_steps, funnel_executions, funnel_execution_steps**

### Funnel Step "Internal Label"
- Each step in `automation_funnel_steps` has an optional `label text` column (nullable). Set per-step via the funnel builder's edit form (top input, "Internal Label").
- API: `POST /api/admin/crm/funnels/:id/steps` and `PUT /api/admin/crm/funnels/:id/steps/:stepId` accept `label` (trimmed string; empty/whitespace → null). `config` jsonb is unaffected — frontend uses `__label` key in stepDraft and destructures it before sending.
- Display priority across UI/API: `step.label` (custom Internal Label) → email subject (for send_email steps) → `actionType`. Used by funnel builder card heading, `/step-report` (`label` + `customLabel` fields), and `/executions` timeline labels.

### Automation Report Page (FluentCRM-style)
- Route: `/admin/crm/automation/:id/report` → `artifacts/course-platform/src/pages/admin/automation-report.tsx`
- Desktop-optimized layout: `max-w-[1600px]` wrapper, hero card (breadcrumb → Zap-icon title row + status pill → Trigger/Steps/Created/ID meta → 5-col KPI strip: Subscribers, Avg Completion, Emails Sent, Delivery Success, Today)
- Three tabs in a single card: Chart Report (12-col grid: bar+line chart 8 cols + Step Overview sidebar with mini progress bars 4 cols), Step Report (table with inline gradient progress bars in Completion column), Email Analytics (8 stat cards in 2 rows + 7-day chart + recent table)
- Individual Reporting table: gradient-avatar rows, expand-to-vertical-timeline (color-coded dots per step status), delete action, pagination with "showing X of Y" counter
- Backend endpoints (admin only): `GET/DELETE /api/admin/crm/funnels/:id/{report,step-report,executions,executions/:executionId}`
- `triggerFunnel()` records each execution + per-step row lazily on attempt (so step-report metrics reflect real drop-off)
- Known limitation: in-flight `wait` steps are scheduled with `setTimeout`, so an API restart will leave executions stuck in `running` until manually cleaned up — replace with a persistent scheduler before high-volume use

### Email Open / Click / Unsubscribe Tracking
- Schema additions on `email_sends`: `tracking_token` (unique), `opened_at`, `open_count`, `clicked_at`, `click_count`, `unsubscribed_at`. Plus `email_unsubscribed_at` on `users`. Applied via direct SQL ALTER (drizzle-kit push had unrelated interactive prompt).
- `crm.ts` helpers: `newTrackingToken()` (16-byte hex), `getPublicBaseUrl()` (uses `REPLIT_DEV_DOMAIN`), `signClickTarget(token, target)` (HMAC-SHA256 of `${token}:${target}` keyed on `SESSION_SECRET`, truncated to 16 hex chars), `injectEmailTracking(html, token)` (Pass 1 rewrites href on any anchor whose text/attrs contain "unsubscribe"; Pass 2 rewrites all other hrefs through the click endpoint with `&sig=`; appends footer only when Pass 1 missed; appends 1×1 open-pixel), `isUserUnsubscribed(email)`. All 6 real send call sites skip-if-unsubscribed → inject tracking → store token.
- Public routes mounted at `/api/email/`: `GET /track/open/:token` (returns 1×1 GIF + COALESCE openedAt + bumps open_count); `GET /track/click/:token?to=&sig=` (looks up token → 404 if unknown; verifies HMAC sig with `timingSafeEqual` → 400 if mismatch/missing; only http(s) absolute or root-relative `/foo` targets allowed, else falls back to `/`; bumps click_count, COALESCEs clickedAt, also sets openedAt if null; 302); `GET /unsubscribe/:token` (HTML confirmation, marks send + user). Lives in `artifacts/api-server/src/routes/email-tracking.ts`.
- `/funnels/:id/report` stats now expose `opened`, `openRate`, `clicked`, `clickRate`, `unsubscribed` (1-decimal rates, sent-as-denominator). Frontend `automation-report.tsx` reads these directly.
- Security: open-redirect closed by token+HMAC double check. Note: `signClickTarget` (and `auth.ts` JWT) fall back to `"dev-secret-change-in-production"` if `SESSION_SECRET` is unset — production must enforce a real secret (currently set to a strong 88-char value).

## Features

- JWT auth via httpOnly cookies
- Simulated checkout (Stripe + Razorpay gateways — no real keys needed)
- Coupon codes with percentage/fixed discount support
- Affiliate program with referral tracking, click counting, commission calculation
- Payout request → admin approval workflow
- Progress tracking per lesson
- Admin analytics with revenue chart (recharts)
- Notification system
- Platform settings (commission rate, enabled gateways)
- CRM: email lists, tags, campaigns, sequences, SMTP with multi-account fallback
- **Visual Automation Funnel Builder** (FluentCRM-style): create funnels with trigger → action steps flow
  - Trigger types: user_signup, new_purchase, tag_applied, list_added
  - Action types: wait (X days/hours), apply_list, remove_list, apply_tag, remove_tag, send_email, end
  - Draft/Published toggle; steps added/edited/deleted inline via visual flow UI
  - Execution engine: `triggerFunnel()` in crm.ts for programmatic firing
  - **`user_signup` trigger fired from**: auth.ts /register, auth.ts Google OAuth, payments.ts simulated /checkout/guest, bundles.ts simulated /checkout/guest, **and all 6 live-gateway create-order routes** (Cashfree/Paytm/Stripe × course/bundle). Fires at user-creation time, not at payment success — so welcome email lands even if checkout is abandoned.
  - Known limitation: `wait` steps use `setTimeout` in-process — long delays do NOT survive API restart (needs DB-backed scheduler in a future PR).

## Paytm Integration Notes (2026-04)

- **Flow**: Classic PG (form-POST to `/order/process`) — same approach as the official WordPress Paytm plugin. Theia/initiateTransaction API is NOT used because most legacy Indian merchant accounts aren't activated for it (returns `501 System Error`).
- **Backend**: `payments.ts` and `bundles.ts` `/paytm/create-order` endpoints return `{ paytmParams: {...with CHECKSUMHASH}, actionUrl, orderId, ... }`. Frontend builds a hidden HTML form from `paytmParams` and auto-submits to `actionUrl`.
- **Callback**: `/paytm/callback` parses Paytm's form-POST response, verifies CHECKSUMHASH via `PaytmChecksum.verifySignature`, calls `completePaytmPayment()` (idempotent enrollment helper), then 303-redirects browser to `${origin}/payment/verify?gateway=paytm&order_id=...`.
- **Verify endpoint**: `/paytm/verify` first checks DB status (callback may have already completed payment); falls back to `/v3/order/status` server-to-server query for pending payments.
- **Common pitfall — "Invalid checksum"**: If Paytm returns `RESPMSG=Invalid checksum`, the merchant key is wrong for that environment. Production and staging keys are DIFFERENT for the same MID. Verify by signing the same request for staging — if staging accepts the checksum (returns "technical error" instead of "Invalid checksum"), you have a staging key configured against a production endpoint.
- **websiteName**: Defaults to `DEFAULT` (production) / `WEBSTAGING` (test). Override per-merchant via Webhook Secret = `WS:<your-website-name>`.
- **Library**: `paytmchecksum` v1.5.1 (NPM). `generateSignature(paramsObj, key)` produces a non-deterministic checksum (uses random IV) and `verifySignature(paramsObj, key, hash)` round-trips correctly.

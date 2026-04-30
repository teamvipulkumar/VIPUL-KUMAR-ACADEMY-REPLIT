# EduPro — Online Course Platform

## Overview
EduPro is a full-stack SaaS online course selling platform designed to offer a robust and engaging learning experience. It features a dark/blue premium theme and is built as a pnpm monorepo. The platform aims to provide a comprehensive solution for course creators and students, incorporating advanced features like a visual automation funnel builder, affiliate programs, and secure payment integrations.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.

## System Architecture

### UI/UX Decisions
The platform features a dark/blue premium theme.
Frontend is built with React, Vite, Wouter router, TanStack Query, Tailwind CSS, and shadcn/ui.
Includes a responsive design with specific layouts for admin dashboards and reports.

### Technical Implementations
**Monorepo Structure**: Uses pnpm workspaces to manage `course-platform` (frontend), `api-server` (backend), `api-spec` (API codegen), and `db` (database schema).
**Authentication**: JWT authentication managed via httpOnly cookies. Includes login, registration with referral support, password reset, and Google OAuth.
**API Layer**: Express.js 5 for the API server, with Pino for logging.
**Database & ORM**: PostgreSQL via Supabase, with Drizzle ORM for schema management. `SUPABASE_DATABASE_URL` is mandatory.
**File Storage**: Supabase Storage for public uploads, streaming directly from memory.
**API Codegen**: Orval generates React Query hooks from an OpenAPI specification.
**Validation**: Zod and drizzle-zod for data validation.
**Payment Gateways**: Simulated Stripe and Razorpay integrations. Paytm integration with specific domain and header requirements, including secure transaction initiation and callback verification. Cashfree integration with robust webhook signature verification.
**Security**:
    - **CORS Lockdown**: Strict origin allowlist based on environment variables and Replit domains.
    - **CSRF Defense**: Origin/Referer validation middleware on all state-changing requests, with exemptions for authenticated webhooks. `SameSite=lax` cookies are used.
    - **JWT Secret**: Enforces strong `SESSION_SECRET` in production, with per-process random secrets in development.
    - **Rate Limiting**: Implemented on authentication, payment, and coupon endpoints.
    - **Access Control**: `/api/analytics/recent-activity` now requires admin privileges.
    - **Upload Security**: SVG uploads are blocked to prevent XSS.
    - **SQL Injection Prevention**: Replaced `sql.raw` with Drizzle's parameterized `inArray()`.
    - **Helmet**: Integration for various HTTP security headers (HSTS, X-Content-Type-Options, etc.).
    - **Cookie Security**: All JWT cookies are `httpOnly`, `sameSite: "lax"`, `path: "/"`, and `secure` in production.
**Maintenance Mode**: Production-grade gate in `index.html` that blocks the page before React boots, showing a static maintenance message if activated and the user is not an admin.
**Deferred Account Creation**: User accounts are only materialized after payment confirmation, making `payments.user_id` nullable and storing `pending_password_hash`.
**Guest Checkout Impersonation Fix**: Prevents auto-login for existing users during guest checkout if not already authenticated, and synthesizes `safeUser` data to prevent profile leaks.

### Feature Specifications
**Course Management**: CRUD operations for courses, modules, and lessons.
**Enrollment & Progress**: Tracking of enrolled courses and lesson completion.
**Affiliate Program**: Referral tracking, click counting, commission calculation, and payout request workflow. Approved affiliates see a one-time welcome popup + 6-step interactive dashboard tour on their first visit, persisted via `affiliate_applications.welcomed_at` and a `POST /api/affiliate/welcome-complete` endpoint.
**Analytics**: Admin dashboard with revenue charts and user management.
**Notification System**: In-app notifications.
**Platform Settings**: Configuration for commission rates and enabled payment gateways.
**CRM**: Features for email lists, tags, campaigns, sequences, and multi-account SMTP.
**Visual Automation Funnel Builder (FluentCRM-style)**:
    - Allows creation of multi-step automation funnels with triggers and actions.
    - Trigger Types: `user_signup`, `new_purchase`, `tag_applied`, `list_added`.
    - Action Types: `wait`, `apply_list`, `remove_list`, `apply_tag`, `remove_tag`, `send_email`, `end`.
    - Supports draft/published states and inline editing via a visual UI.
    - `user_signup` trigger fires at user creation time (e.g., registration, guest checkout).
**Email Tracking**: Open, click, and unsubscribe tracking for emails, with secure link rewriting and HMAC-SHA256 signature verification.

## External Dependencies

- **Supabase**: PostgreSQL database and Storage for file uploads.
- **Drizzle ORM**: Database schema definition and migration.
- **Express.js**: Backend API framework.
- **Pino**: Logger for the API server.
- **React**: Frontend UI library.
- **Vite**: Frontend build tool.
- **Wouter**: React router.
- **TanStack Query**: Data fetching and caching library.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: UI component library.
- **Orval**: OpenAPI spec to API client code generator.
- **Zod**: Schema declaration and validation library.
- **drizzle-zod**: Zod integration for Drizzle ORM.
- **`express-rate-limit`**: Middleware for rate limiting.
- **Helmet**: Collection of middleware to secure Express apps.
- **`paytmchecksum`**: Library for Paytm checksum generation and verification.
- **Stripe**: Payment gateway (simulated integration).
- **Razorpay**: Payment gateway (simulated integration).
- **Cashfree**: Payment gateway.
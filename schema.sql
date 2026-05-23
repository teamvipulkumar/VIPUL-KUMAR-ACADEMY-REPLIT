-- EduPro Platform — Full Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- Safe to run multiple times (uses IF NOT EXISTS / CREATE TABLE IF NOT EXISTS)

-- Users
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin','student','affiliate')),
  avatar_url text,
  referral_code text NOT NULL UNIQUE,
  is_banned boolean NOT NULL DEFAULT false,
  email_verified boolean NOT NULL DEFAULT false,
  email_verify_token text,
  email_verify_token_expires_at timestamptz,
  phone text,
  reset_token text,
  reset_token_expires_at timestamptz,
  email_unsubscribed_at timestamptz,
  affiliate_fee_paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id serial PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  thumbnail_url text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  category text NOT NULL,
  level text NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner','intermediate','advanced')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  tag text CHECK (tag IN ('coming_soon')),
  duration_minutes integer NOT NULL DEFAULT 0,
  compare_at_price numeric(10,2),
  show_on_website boolean NOT NULL DEFAULT true,
  creator_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Modules
CREATE TABLE IF NOT EXISTS modules (
  id serial PRIMARY KEY,
  course_id integer NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lessons
CREATE TABLE IF NOT EXISTS lessons (
  id serial PRIMARY KEY,
  module_id integer NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'video' CHECK (type IN ('video','text','pdf','quiz','link','embed')),
  video_url text,
  content text,
  resource_url text,
  duration_minutes integer,
  "order" integer NOT NULL DEFAULT 0,
  is_free text NOT NULL DEFAULT 'false',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Bundles
CREATE TABLE IF NOT EXISTS bundles (
  id serial PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  thumbnail_url text,
  price numeric(10,2) NOT NULL,
  compare_at_price numeric(10,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bundle ↔ Courses join
CREATE TABLE IF NOT EXISTS bundle_courses (
  id serial PRIMARY KEY,
  bundle_id integer NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  course_id integer NOT NULL REFERENCES courses(id) ON DELETE CASCADE
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id serial PRIMARY KEY,
  user_id integer REFERENCES users(id) ON DELETE CASCADE,
  course_id integer REFERENCES courses(id) ON DELETE SET NULL,
  bundle_id integer REFERENCES bundles(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  gateway text NOT NULL CHECK (gateway IN ('stripe','razorpay','cashfree','paytm','payu')),
  session_id text NOT NULL UNIQUE,
  payment_id text,
  gateway_order_id text,
  coupon_code text,
  affiliate_ref text,
  billing_name text,
  billing_email text,
  billing_mobile text,
  billing_state text,
  pending_password_hash text,
  allow_auto_login boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enrollments
CREATE TABLE IF NOT EXISTS enrollments (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id integer NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Lesson completions
CREATE TABLE IF NOT EXISTS lesson_completions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id integer NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Platform settings (singleton row)
CREATE TABLE IF NOT EXISTS platform_settings (
  id serial PRIMARY KEY,
  site_name text NOT NULL DEFAULT 'EduPro',
  site_description text NOT NULL DEFAULT 'Learn and grow with our courses',
  commission_rate integer NOT NULL DEFAULT 20,
  currency text NOT NULL DEFAULT 'USD',
  stripe_enabled boolean NOT NULL DEFAULT true,
  razorpay_enabled boolean NOT NULL DEFAULT false,
  email_notifications_enabled boolean NOT NULL DEFAULT true,
  affiliate_enabled boolean NOT NULL DEFAULT true,
  affiliate_cookie_days integer NOT NULL DEFAULT 30,
  affiliate_min_payout integer NOT NULL DEFAULT 500,
  payout_period_days integer NOT NULL DEFAULT 7,
  payout_week_day integer,
  google_sign_in_enabled boolean NOT NULL DEFAULT false,
  google_client_id text,
  google_client_secret text,
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text,
  order_prefix text NOT NULL DEFAULT 'ORD',
  order_suffix text NOT NULL DEFAULT '',
  show_featured_courses boolean NOT NULL DEFAULT true,
  show_featured_packages boolean NOT NULL DEFAULT true,
  facebook_pixel_enabled boolean NOT NULL DEFAULT false,
  facebook_pixel_id text,
  facebook_access_token text,
  facebook_pixel_base_code text,
  facebook_test_event_code text,
  site_url text NOT NULL DEFAULT '',
  site_logo text,
  site_logo_light text,
  logo_size integer NOT NULL DEFAULT 34,
  logo_size_mobile integer NOT NULL DEFAULT 28,
  favicon text,
  meta_title text,
  meta_description text,
  email_log_retention_days integer,
  last_creator_payout_cycle_at timestamptz,
  affiliate_fee_enabled boolean NOT NULL DEFAULT false,
  affiliate_fee_amount integer NOT NULL DEFAULT 99,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the singleton settings row
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Payment gateways
CREATE TABLE IF NOT EXISTS payment_gateways (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  api_key text NOT NULL DEFAULT '',
  secret_key text NOT NULL DEFAULT '',
  webhook_secret text,
  extra_config text,
  is_active boolean NOT NULL DEFAULT false,
  is_test_mode boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value numeric(10,2) NOT NULL,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  course_id integer REFERENCES courses(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Commission groups
CREATE TABLE IF NOT EXISTS commission_groups (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  commission_rate integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id serial PRIMARY KEY,
  referrer_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  course_id integer REFERENCES courses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'click' CHECK (status IN ('click','signup','purchase')),
  commission numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Payout requests
CREATE TABLE IF NOT EXISTS payout_requests (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  payment_method text NOT NULL,
  payment_details text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Affiliate applications
CREATE TABLE IF NOT EXISTS affiliate_applications (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  promote_description text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  reviewed_at timestamptz,
  welcomed_at timestamptz,
  is_blocked boolean NOT NULL DEFAULT false,
  commission_override integer,
  commission_group_id integer REFERENCES commission_groups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Affiliate clicks
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id serial PRIMARY KEY,
  affiliate_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_hash text,
  user_agent text,
  course_id integer REFERENCES courses(id) ON DELETE SET NULL,
  is_unique boolean NOT NULL DEFAULT true,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Affiliate KYC
CREATE TABLE IF NOT EXISTS affiliate_kyc (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id_proof_url text,
  address_proof_url text,
  id_proof_name text,
  address_proof_name text,
  pan_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

-- Affiliate bank details
CREATE TABLE IF NOT EXISTS affiliate_bank_details (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_holder_name text NOT NULL,
  account_number text NOT NULL,
  ifsc_code text NOT NULL,
  bank_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Affiliate creatives
CREATE TABLE IF NOT EXISTS affiliate_creatives (
  id serial PRIMARY KEY,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('image','banner','text')),
  url text,
  content text,
  headline text,
  description text,
  uploaded_by_admin_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Affiliate pixels
CREATE TABLE IF NOT EXISTS affiliate_pixels (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facebook_pixel_id text,
  access_token text,
  track_page_view boolean NOT NULL DEFAULT true,
  track_purchase boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Admin staff
CREATE TABLE IF NOT EXISTS admin_staff (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role_name text NOT NULL,
  permissions jsonb NOT NULL,
  previous_role text NOT NULL DEFAULT 'student',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  invited_by integer REFERENCES users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Creators
CREATE TABLE IF NOT EXISTS creators (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  pan_name text,
  pan_number text,
  pan_front_url text,
  id_proof_url text,
  address_proof_url text,
  kyc_status text NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','approved','rejected')),
  kyc_admin_note text,
  kyc_reviewed_at timestamptz,
  account_holder_name text,
  account_number text,
  ifsc_code text,
  bank_name text,
  upi_id text,
  preferred_payment_method text DEFAULT 'bank' CHECK (preferred_payment_method IN ('bank','upi')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  invited_by integer REFERENCES users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- FK: courses.creator_id → creators.id
ALTER TABLE courses ADD COLUMN IF NOT EXISTS creator_id integer REFERENCES creators(id) ON DELETE SET NULL;

-- Creator payouts
CREATE TABLE IF NOT EXISTS creator_payouts (
  id serial PRIMARY KEY,
  creator_id integer NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled')),
  release_date timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  released_by integer REFERENCES users(id) ON DELETE SET NULL,
  released_by_system boolean NOT NULL DEFAULT false,
  payment_method text CHECK (payment_method IN ('bank','upi','manual')),
  payment_reference text,
  failure_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Creator commissions
CREATE TABLE IF NOT EXISTS creator_commissions (
  id serial PRIMARY KEY,
  creator_id integer NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_id integer NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  course_id integer REFERENCES courses(id) ON DELETE SET NULL,
  bundle_id integer REFERENCES bundles(id) ON DELETE SET NULL,
  sale_amount_share numeric(10,2) NOT NULL,
  commission_percent numeric(5,2) NOT NULL DEFAULT 25,
  commission_amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'earned' CHECK (status IN ('earned','paid','cancelled')),
  payout_id integer REFERENCES creator_payouts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- GST company settings (singleton)
CREATE TABLE IF NOT EXISTS gst_company_settings (
  id serial PRIMARY KEY,
  company_name text NOT NULL DEFAULT '',
  gstin text NOT NULL DEFAULT '',
  address_line1 text NOT NULL DEFAULT '',
  address_line2 text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  state_code text NOT NULL DEFAULT '',
  pincode text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  logo_url text,
  stamp_url text,
  gst_rate integer NOT NULL DEFAULT 18,
  invoice_prefix text NOT NULL DEFAULT 'INV',
  next_invoice_seq integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO gst_company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- GST invoices
CREATE TABLE IF NOT EXISTS gst_invoices (
  id serial PRIMARY KEY,
  invoice_number text NOT NULL UNIQUE,
  payment_id integer REFERENCES payments(id) ON DELETE SET NULL,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  course_id integer REFERENCES courses(id) ON DELETE SET NULL,
  bundle_id integer REFERENCES bundles(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  customer_email text NOT NULL DEFAULT '',
  customer_mobile text,
  customer_gstin text,
  customer_address text NOT NULL DEFAULT '',
  customer_state text NOT NULL DEFAULT '',
  customer_state_code text NOT NULL DEFAULT '',
  course_title text NOT NULL DEFAULT '',
  base_amount numeric(10,2) NOT NULL DEFAULT 0,
  gst_rate integer NOT NULL DEFAULT 18,
  cgst_amount numeric(10,2) NOT NULL DEFAULT 0,
  sgst_amount numeric(10,2) NOT NULL DEFAULT 0,
  igst_amount numeric(10,2) NOT NULL DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  is_interstate boolean NOT NULL DEFAULT false,
  financial_year text NOT NULL DEFAULT '',
  gateway text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SMTP settings (singleton)
CREATE TABLE IF NOT EXISTS smtp_settings (
  id serial PRIMARY KEY,
  name text NOT NULL DEFAULT 'Primary SMTP',
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 587,
  secure boolean NOT NULL DEFAULT false,
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT 'Vipul Kumar Academy',
  from_email text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO smtp_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- SMTP accounts (multi)
CREATE TABLE IF NOT EXISTS smtp_accounts (
  id serial PRIMARY KEY,
  name text NOT NULL DEFAULT 'Backup SMTP',
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 587,
  secure boolean NOT NULL DEFAULT false,
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  from_email text NOT NULL DEFAULT '',
  priority integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  last_error text,
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id serial PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'custom',
  subject text NOT NULL,
  html_body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Email campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id serial PRIMARY KEY,
  name text NOT NULL,
  subject text NOT NULL,
  template_id integer REFERENCES email_templates(id) ON DELETE SET NULL,
  html_body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  recipient_filter text NOT NULL DEFAULT 'all' CHECK (recipient_filter IN ('all','enrolled','not_enrolled','list','tag')),
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  list_id integer,
  tag_id integer,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Email automation rules
CREATE TABLE IF NOT EXISTS email_automation_rules (
  id serial PRIMARY KEY,
  event text NOT NULL UNIQUE,
  template_id integer REFERENCES email_templates(id) ON DELETE SET NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  delay_minutes integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Email sends log
CREATE TABLE IF NOT EXISTS email_sends (
  id serial PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('campaign','automation','test','sequence')),
  campaign_id integer REFERENCES email_campaigns(id) ON DELETE SET NULL,
  automation_event text,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  email text NOT NULL,
  subject text NOT NULL,
  html_body text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed')),
  fail_reason text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  tracking_token text UNIQUE,
  opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  clicked_at timestamptz,
  click_count integer NOT NULL DEFAULT 0,
  unsubscribed_at timestamptz
);

-- Email lists
CREATE TABLE IF NOT EXISTS email_lists (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'manual' CHECK (type IN ('manual','optin','enrolled','all_subscribers')),
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Email list members
CREATE TABLE IF NOT EXISTS email_list_members (
  id serial PRIMARY KEY,
  list_id integer NOT NULL REFERENCES email_lists(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscribed_at timestamptz NOT NULL DEFAULT now()
);

-- Contact tags
CREATE TABLE IF NOT EXISTS contact_tags (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6366f1',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Contact tag assignments
CREATE TABLE IF NOT EXISTS contact_tag_assignments (
  id serial PRIMARY KEY,
  tag_id integer NOT NULL REFERENCES contact_tags(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cta_uniq UNIQUE (tag_id, user_id)
);

-- Email sequences
CREATE TABLE IF NOT EXISTS email_sequences (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  trigger text NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual','welcome','purchase','completion','tag_assigned')),
  trigger_filter text,
  is_active boolean NOT NULL DEFAULT false,
  enrolled_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Email sequence steps
CREATE TABLE IF NOT EXISTS email_sequence_steps (
  id serial PRIMARY KEY,
  sequence_id integer NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  delay_days integer NOT NULL DEFAULT 0,
  subject text NOT NULL,
  html_body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Email sequence enrollments
CREATE TABLE IF NOT EXISTS email_sequence_enrollments (
  id serial PRIMARY KEY,
  sequence_id integer NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  next_send_at timestamptz,
  CONSTRAINT ese_uniq UNIQUE (sequence_id, user_id)
);

-- Automation funnels
CREATE TABLE IF NOT EXISTS automation_funnels (
  id serial PRIMARY KEY,
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'user_signup',
  trigger_config jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Automation funnel steps
CREATE TABLE IF NOT EXISTS automation_funnel_steps (
  id serial PRIMARY KEY,
  funnel_id integer NOT NULL REFERENCES automation_funnels(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 0,
  action_type text NOT NULL,
  label text,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Funnel executions
CREATE TABLE IF NOT EXISTS funnel_executions (
  id serial PRIMARY KEY,
  funnel_id integer NOT NULL REFERENCES automation_funnels(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  current_step_order integer NOT NULL DEFAULT 0,
  next_action_type text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_executed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Funnel execution steps
CREATE TABLE IF NOT EXISTS funnel_execution_steps (
  id serial PRIMARY KEY,
  execution_id integer NOT NULL REFERENCES funnel_executions(id) ON DELETE CASCADE,
  funnel_step_id integer NOT NULL,
  step_order integer NOT NULL,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','skipped')),
  executed_at timestamptz,
  error_message text
);

-- Code snippets
CREATE TABLE IF NOT EXISTS code_snippets (
  id serial PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  code text NOT NULL DEFAULT '',
  placement text NOT NULL DEFAULT 'head' CHECK (placement IN ('head','body_start','body_end')),
  enabled boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pages (for page builder)
CREATE TABLE IF NOT EXISTS pages (
  id serial PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content jsonb NOT NULL DEFAULT '[]',
  is_published boolean NOT NULL DEFAULT false,
  meta_title text,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Useful indexes for FK lookup performance
CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_course_id ON payments(course_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate_id ON affiliate_clicks(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_user_id ON email_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_funnel_executions_funnel_id ON funnel_executions(funnel_id);
CREATE INDEX IF NOT EXISTS idx_funnel_executions_user_id ON funnel_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_commissions_creator_id ON creator_commissions(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_commissions_payment_id ON creator_commissions(payment_id);

-- ====================================================================
-- Practical Pathways CRM Database Initialization Migration
-- Target: Supabase PostgreSQL (Strict Organization Scoping, UTC Timestamps)
-- ====================================================================

-- Enable necessary PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom Enum Types
CREATE TYPE user_role AS ENUM ('owner', 'agent');
CREATE TYPE lifecycle_status AS ENUM ('lead', 'contact', 'customer', 'archived');
CREATE TYPE capture_channel AS ENUM ('website', 'meta_ads', 'google_ads', 'manual', 'csv_import');
CREATE TYPE marketing_source AS ENUM ('google', 'meta', 'organic', 'direct', 'referral', 'unknown');
CREATE TYPE deal_stage AS ENUM ('new_opportunity', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE call_outcome AS ENUM (
  'connected',
  'no_answer',
  'busy',
  'wrong_number',
  'interested',
  'not_interested',
  'callback_requested',
  'appointment_booked',
  'do_not_call'
);
CREATE TYPE email_status AS ENUM ('queued', 'submitted', 'delivered', 'failed', 'bounced', 'suppressed');
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'dead_letter');
CREATE TYPE job_type AS ENUM ('process_lead', 'send_email', 'check_followups', 'sync_webhook');
CREATE TYPE integration_status AS ENUM (
  'not_connected',
  'configuration_incomplete',
  'connected_and_verified',
  'token_expired',
  'permission_missing',
  'error'
);

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  website TEXT,
  default_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Karachi',
  default_currency VARCHAR(8) NOT NULL DEFAULT 'PKR',
  email_sender_name VARCHAR(255) NOT NULL DEFAULT 'Practical Pathways',
  email_sender_address VARCHAR(255) NOT NULL DEFAULT 'info@pracpathways.com.au',
  reply_to_email VARCHAR(255) NOT NULL DEFAULT 'info@pracpathways.com.au',
  round_robin_index INT NOT NULL DEFAULT 0,
  auto_acknowledge_leads BOOLEAN NOT NULL DEFAULT true,
  notify_owners_new_lead BOOLEAN NOT NULL DEFAULT true,
  notify_agents_new_lead BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. Profiles Table (Linked to auth.users in Supabase)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY, -- References auth.users(id) in Supabase Auth
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role user_role NOT NULL DEFAULT 'agent',
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. Invitations Table (For secure owner & agent provisioning)
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'agent',
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 4. Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  email_normalized VARCHAR(255) NOT NULL,
  phone_raw VARCHAR(50),
  phone_normalized VARCHAR(50),
  company VARCHAR(255),
  city VARCHAR(100),
  country VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  assigned_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  lifecycle_status lifecycle_status NOT NULL DEFAULT 'lead',
  first_enquiry_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  latest_enquiry_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  do_not_call BOOLEAN NOT NULL DEFAULT false,
  email_suppressed BOOLEAN NOT NULL DEFAULT false,
  suppression_reason TEXT,
  communication_preferences JSONB DEFAULT '{"email": true, "sms": true, "whatsapp": true, "phone": true}'::jsonb,
  conflict_flag BOOLEAN NOT NULL DEFAULT false,
  conflict_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for lightning fast searching, deduplication, and agent queries
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email_norm ON contacts(organization_id, email_normalized);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_norm ON contacts(organization_id, phone_normalized);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned ON contacts(organization_id, assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_contacts_next_follow_up ON contacts(organization_id, next_follow_up_at);
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle ON contacts(organization_id, lifecycle_status);

-- 5. Lead Submissions (Enquiries / Touchpoints)
CREATE TABLE IF NOT EXISTS lead_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  capture_channel capture_channel NOT NULL,
  marketing_source marketing_source NOT NULL DEFAULT 'unknown',
  provider VARCHAR(64) NOT NULL, -- 'website', 'meta', 'google', 'csv', 'manual'
  provider_lead_id VARCHAR(255),
  form_id VARCHAR(255),
  campaign_id VARCHAR(255),
  campaign_name VARCHAR(255),
  ad_set_id VARCHAR(255),
  ad_id VARCHAR(255),
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  utm_term VARCHAR(255),
  utm_content VARCHAR(255),
  gclid VARCHAR(255),
  fbclid VARCHAR(255),
  landing_page TEXT,
  referrer TEXT,
  submitted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent_text TEXT,
  consent_timestamp TIMESTAMPTZ,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  idempotency_key VARCHAR(255) NOT NULL,
  is_test BOOLEAN NOT NULL DEFAULT false,
  submission_timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_idempotency 
  ON lead_submissions(organization_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_lead_contact ON lead_submissions(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_created ON lead_submissions(organization_id, created_at DESC);

-- 6. Deals (Opportunities Pipeline)
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  assigned_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  stage deal_stage NOT NULL DEFAULT 'new_opportunity',
  value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(8) NOT NULL DEFAULT 'PKR',
  expected_close_date DATE,
  loss_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_deals_org ON deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(organization_id, stage);
CREATE INDEX IF NOT EXISTS idx_deals_assigned ON deals(organization_id, assigned_agent_id);

-- 7. Tasks & Follow-ups
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  assigned_agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'pending',
  reminder_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_due ON tasks(assigned_agent_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_contact ON tasks(contact_id);

-- 8. Call Logs (Human Agent Workspace)
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  outcome call_outcome NOT NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  notes TEXT,
  next_action VARCHAR(255),
  follow_up_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_calls_contact ON call_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_calls_agent ON call_logs(agent_id, timestamp DESC);

-- 9. Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_notes_contact ON notes(contact_id);

-- 10. Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(organization_id, slug)
);

-- 11. Email Messages & Outbox History
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  status email_status NOT NULL DEFAULT 'queued',
  provider_message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_emails_contact ON email_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON email_messages(organization_id, status);

-- 12. Durable Job Queue (Outbox & Asynchronous Background Tasks)
CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_type job_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status job_status NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(100),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_job_queue_fetch 
  ON job_queue(status, next_run_at) 
  WHERE status IN ('pending', 'processing');

-- 13. Audit Events (Append-only security log)
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(100) NOT NULL,
  target_id VARCHAR(255) NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_audit_org_created 
  ON audit_events(organization_id, created_at DESC);

-- 14. In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  type VARCHAR(50) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_notif_user 
  ON notifications(user_id, is_read, created_at DESC);

-- 15. Integration Connections
CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider VARCHAR(64) NOT NULL,
  status integration_status NOT NULL DEFAULT 'not_connected',
  credentials_encrypted JSONB DEFAULT '{}'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,
  last_verified_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(organization_id, provider)
);

-- 16. Webhook Events Table (Raw Audited Payloads & Replay Defense)
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  headers JSONB DEFAULT '{}'::jsonb,
  raw_body TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'received',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(organization_id, provider, idempotency_key)
);

-- 17. Suppression Records (Email & Phone opt-out compliance)
CREATE TABLE IF NOT EXISTS suppression_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255),
  phone VARCHAR(50),
  reason VARCHAR(64) NOT NULL,
  source VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_suppress_email ON suppression_records(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_suppress_phone ON suppression_records(organization_id, phone);

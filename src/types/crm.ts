export type Role = 'owner' | 'agent';

export type LifecycleStatus = 'lead' | 'contact' | 'customer' | 'archived';

export type CaptureChannel = 
  | 'website' 
  | 'meta_ads' 
  | 'google_ads' 
  | 'manual' 
  | 'csv_import';

export type MarketingSource = 
  | 'google' 
  | 'meta' 
  | 'organic' 
  | 'direct' 
  | 'referral' 
  | 'unknown';

// Education-focused Course Enquiry Pipeline Stages
export type DealStage = 
  | 'new_enquiry'
  | 'assigned'
  | 'contact_attempted'
  | 'contacted'
  | 'course_discussion'
  | 'eligibility_review'
  | 'application_started'
  | 'documents_pending'
  | 'enrolled'
  | 'not_proceeding';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'completed' | 'cancelled';

export type CallOutcome = 
  | 'connected' 
  | 'no_answer' 
  | 'busy' 
  | 'wrong_number' 
  | 'interested' 
  | 'not_interested' 
  | 'callback_requested' 
  | 'appointment_booked' 
  | 'do_not_call';

export type EmailStatus = 
  | 'queued' 
  | 'submitted' 
  | 'delivered' 
  | 'failed' 
  | 'bounced' 
  | 'suppressed';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';

export type JobType = 
  | 'process_lead' 
  | 'send_email' 
  | 'check_followups' 
  | 'sync_webhook';

export type IntegrationStatus = 
  | 'not_configured'
  | 'configuration_incomplete' 
  | 'connected_and_verified' 
  | 'authentication_failed' 
  | 'permission_licence_limitation' 
  | 'processing_error'
  | 'not_connected'
  | 'token_expired' 
  | 'permission_missing' 
  | 'error';

export interface Course {
  id: string;
  organization_id: string;
  code: string; // e.g. 'CPC40120', 'CPC50220'
  title: string;
  delivery_variant: string; // 'Self-Paced Online' | 'Blended / Structured Delivery'
  official_url: string;
  is_active: boolean;
  short_description: string;
  email_information: string;
  custom_fields?: Record<string, any>;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  rto_code?: string; // RTO # 22256
  logo_url?: string;
  website?: string;
  default_timezone: string; // 'Australia/Adelaide'
  default_currency: string; // 'AUD'
  default_phone_country_code: string; // '+61'
  email_sender_name: string;
  email_sender_address: string;
  reply_to_email: string;
  round_robin_index: number;
  auto_acknowledge_leads: boolean;
  notify_owners_new_lead: boolean;
  notify_agents_new_lead: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: Role;
  is_active: boolean;
  avatar_url?: string;
  preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  role: Role;
  token: string;
  expires_at: string;
  accepted_at?: string;
  invited_by: string;
  created_at: string;
}

export interface Contact {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  email_normalized: string;
  phone_raw?: string;
  phone_normalized?: string;
  company?: string;
  city?: string;
  country?: string;
  state_or_postcode?: string;
  course_interest?: string;
  delivery_variant?: string;
  course_review_required?: boolean;
  tags: string[];
  assigned_agent_id?: string;
  lifecycle_status: LifecycleStatus;
  first_enquiry_at: string;
  latest_enquiry_at: string;
  last_contacted_at?: string;
  next_follow_up_at?: string;
  do_not_call: boolean;
  email_suppressed: boolean;
  suppression_reason?: string;
  communication_preferences?: {
    email?: boolean;
    sms?: boolean;
    whatsapp?: boolean;
    phone?: boolean;
  };
  conflict_flag?: boolean;
  conflict_details?: string;
  custom_fields?: Record<string, any>;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadSubmission {
  id: string;
  organization_id: string;
  contact_id: string;
  capture_channel: CaptureChannel;
  marketing_source: MarketingSource;
  provider: string; // 'website' | 'meta' | 'google' | 'csv' | 'manual'
  provider_lead_id?: string;
  form_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  ad_set_id?: string;
  ad_id?: string;
  course_interest?: string;
  delivery_variant?: string;
  state_or_postcode?: string;
  course_review_required?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  landing_page?: string;
  referrer?: string;
  submitted_fields: Record<string, any>;
  consent_text?: string;
  consent_timestamp?: string;
  raw_payload?: Record<string, any>;
  idempotency_key: string;
  is_test: boolean;
  submission_timestamp: string;
  processed_at?: string;
  custom_fields?: Record<string, any>;
  is_archived?: boolean;
  created_at: string;
}

export interface Deal {
  id: string;
  organization_id: string;
  contact_id: string;
  assigned_agent_id?: string;
  title: string;
  stage: DealStage;
  course_code?: string;
  course_title?: string;
  delivery_variant?: string;
  value?: number; // Owner-only administrative field; stripped in all agent projections
  currency?: string; // Owner-only administrative field; stripped in all agent projections
  expected_close_date?: string;
  loss_reason?: string;
  notes?: string;
  custom_fields?: Record<string, any>;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  organization_id: string;
  contact_id?: string;
  deal_id?: string;
  assigned_agent_id: string;
  title: string;
  description?: string;
  due_date: string;
  priority: TaskPriority;
  status: TaskStatus;
  reminder_at?: string;
  completed_at?: string;
  custom_fields?: Record<string, any>;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CallLog {
  id: string;
  organization_id: string;
  contact_id: string;
  agent_id: string;
  timestamp: string;
  outcome: CallOutcome;
  duration_seconds: number;
  notes?: string;
  next_action?: string;
  follow_up_date?: string;
  provider?: 'manual' | '3cx';
  provider_call_id?: string;
  direction?: 'inbound' | 'outbound';
  call_status?: 'answered' | 'missed' | 'busy' | 'failed' | 'completed';
  agent_extension?: string;
  caller_number?: string;
  destination_number?: string;
  recording_url?: string;
  created_at: string;
}

export interface Note {
  id: string;
  organization_id: string;
  contact_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  subject: string;
  body_html: string;
  body_text: string;
  variables: string[];
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailMessage {
  id: string;
  organization_id: string;
  contact_id: string;
  template_id?: string;
  recipient_email: string;
  subject: string;
  body_html: string;
  status: EmailStatus;
  provider_message_id?: string;
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

export interface JobQueueItem {
  id: string;
  organization_id: string;
  job_type: JobType;
  payload: Record<string, any>;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  next_run_at: string;
  locked_at?: string;
  locked_by?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: string;
  organization_id: string;
  actor_id?: string;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  type: 'lead_assigned' | 'followup_due' | 'integration_alert' | 'system';
  created_at: string;
}

export type IntegrationProvider = 
  | 'meta_ads' 
  | 'google_ads' 
  | 'email_provider' 
  | 'website_webhook'
  | 'elementor_pro'
  | 'three_cx';

export interface ElementorFieldMappings {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  courseInterest?: string;
  deliveryVariant?: string;
  message?: string;
  stateOrPostcode?: string;
  consent?: string;
  formId?: string;
  pageUrl?: string;
}

export interface ElementorIntegrationConfig {
  webhook_endpoint_url: string;
  signing_secret?: string; // Stored server-side
  secret_token?: string; // Query or header token
  field_mappings: ElementorFieldMappings;
  auto_create_followup_task: boolean;
  suppress_test_emails: boolean;
  last_received_at?: string;
  last_success_at?: string;
  last_error?: string;
  failure_count?: number;
}

export interface ThreeCXIntegrationConfig {
  pbx_url?: string; // e.g. https://ptp.3cx.com.au:5001
  version: 'v18' | 'v20';
  licence_edition: 'Pro' | 'Enterprise / AI' | 'Free / Standard';
  api_key?: string; // Authenticates 3CX CRM template requests
  agent_extensions: {
    ayesha_extension: string; // e.g. '101'
    maryam_extension: string; // e.g. '102'
    jawad_extension?: string;
    sohail_extension?: string;
  };
  features: {
    contact_lookup: boolean;
    call_journaling: boolean;
    screen_pop: boolean;
  };
  last_verified_at?: string;
  last_activity_at?: string;
  last_error?: string;
  failure_count?: number;
}

export interface IntegrationConnection {
  id: string;
  organization_id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  credentials_encrypted?: Record<string, any>;
  config?: Record<string, any>;
  last_verified_at?: string;
  last_activity_at?: string;
  last_error?: string;
  failure_count?: number;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  organization_id: string;
  provider: string;
  idempotency_key: string;
  headers?: Record<string, any>;
  raw_body: string;
  status: 'received' | 'processed' | 'failed' | 'ignored';
  error_message?: string;
  created_at: string;
}

export interface SuppressionRecord {
  id: string;
  organization_id: string;
  email?: string;
  phone?: string;
  reason: 'unsubscribe' | 'hard_bounce' | 'complaint' | 'manual_dnc';
  source?: string;
  created_at: string;
}

export interface UserCredential {
  user_id: string;
  email: string;
  password_hash: string;
  salt: string;
  temp_password_active?: boolean;
  updated_at: string;
}

export interface SessionRecord {
  token: string;
  user_id: string;
  email: string;
  role: Role;
  expires_at: string;
  created_at: string;
}

// -------------------------------------------------------------
// Module & Field Builder Types (Owner Only Administration)
// -------------------------------------------------------------

export type CustomFieldType =
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'datetime'
  | 'single_select'
  | 'multi_select'
  | 'checkbox'
  | 'url'
  | 'user_reference'
  | 'record_relationship';

export interface FieldOption {
  label: string;
  value: string;
  color?: string;
}

export interface FieldValidationRule {
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

export interface FieldDefinition {
  id: string;
  organization_id: string;
  module_key: string; // 'contacts' | 'leads' | 'deals' | 'tasks' | 'courses' | or custom module key
  field_key: string; // Stable internal identifier, e.g. 'funding_eligibility'
  label: string; // Editable display label, e.g. 'Funding Eligibility'
  field_type: CustomFieldType;
  help_text?: string;
  placeholder?: string;
  is_required: boolean;
  default_value?: any;
  options?: FieldOption[];
  validation_rules?: FieldValidationRule;
  section?: string; // e.g. 'General', 'Enrolment & Funding', 'Compliance', 'Custom Details'
  display_order: number;
  show_in_form: boolean;
  show_in_table: boolean;
  show_in_detail: boolean;
  is_owner_only_view: boolean; // Field-level server authorization: hidden from agents
  is_owner_only_edit: boolean; // Field-level server authorization: agent cannot modify
  is_system: boolean; // Protected system fields cannot be deleted
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModuleDefinition {
  id: string;
  organization_id: string;
  key: string; // e.g. 'contacts', 'leads', or custom slug 'employers'
  name: string; // Plural, e.g. 'Employers / Industry Partners'
  singular_name: string; // e.g. 'Employer'
  description: string;
  icon: string; // Lucide icon name, e.g. 'Building2'
  sidebar_position: number;
  is_enabled: boolean;
  is_system: boolean; // contacts, leads, deals, tasks, courses are system
  agent_access: 'none' | 'assigned_only' | 'all'; // Default: 'none' (owner-only)
  table_columns: string[]; // List of field keys to display
  created_at: string;
  updated_at: string;
}

export interface CustomRecord {
  id: string;
  organization_id: string;
  module_key: string;
  title: string;
  assigned_agent_id?: string;
  data: Record<string, any>;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}


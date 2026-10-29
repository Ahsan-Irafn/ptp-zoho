-- ==============================================================================
-- Practical Training Pathways CRM — 3CX & WordPress Elementor Pro Migrations
-- Business: Practical Training Pathways (RTO # 22256)
-- Website: https://www.pracpathways.com.au/
-- Timezone: Australia/Adelaide | Currency: AUD
-- ==============================================================================

-- 1. Extend call_logs table with 3CX Phone System attributes
ALTER TABLE call_logs 
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS provider_call_id TEXT,
    ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'outbound',
    ADD COLUMN IF NOT EXISTS call_status TEXT NOT NULL DEFAULT 'completed',
    ADD COLUMN IF NOT EXISTS agent_extension TEXT,
    ADD COLUMN IF NOT EXISTS caller_number TEXT,
    ADD COLUMN IF NOT EXISTS destination_number TEXT,
    ADD COLUMN IF NOT EXISTS recording_url TEXT;

-- Index for fast 3CX call reconciliation and deduplication
CREATE INDEX IF NOT EXISTS idx_call_logs_provider_id 
    ON call_logs(organization_id, provider_call_id) 
    WHERE provider_call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_logs_agent_ext 
    ON call_logs(organization_id, agent_extension);

-- 2. Ensure webhook_events table supports Elementor Pro HMAC signatures & idempotency
ALTER TABLE webhook_events
    ADD COLUMN IF NOT EXISTS headers JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_webhook_events_idempotency
    ON webhook_events(organization_id, provider, idempotency_key);

-- 3. Extend Integration Providers Check Constraint
ALTER TABLE integration_connections DROP CONSTRAINT IF EXISTS integration_connections_provider_check;
ALTER TABLE integration_connections ADD CONSTRAINT integration_connections_provider_check 
    CHECK (provider IN ('meta_ads', 'google_ads', 'email_provider', 'website_webhook', 'elementor_pro', 'three_cx'));

-- 4. Initial Seed for Elementor Pro and 3CX Phone System Integrations
INSERT INTO integration_connections (
    id,
    organization_id,
    provider,
    status,
    config,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    o.id,
    'elementor_pro',
    'connected_and_verified',
    jsonb_build_object(
        'webhook_endpoint_url', 'https://crm.pracpathways.com.au/api/integrations/elementor/leads',
        'signing_secret', 'ptp_elem_sec_' || encode(gen_random_bytes(16), 'hex'),
        'secret_token', 'ptp_tok_' || encode(gen_random_bytes(12), 'hex'),
        'field_mappings', jsonb_build_object(
            'fullName', 'name',
            'firstName', 'first_name',
            'lastName', 'last_name',
            'email', 'email',
            'phone', 'phone',
            'courseInterest', 'course',
            'deliveryVariant', 'delivery_variant',
            'message', 'message',
            'stateOrPostcode', 'state',
            'consent', 'consent',
            'formId', 'form_id',
            'pageUrl', 'page_url'
        ),
        'auto_create_followup_task', true,
        'suppress_test_emails', true
    ),
    now(),
    now()
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM integration_connections ic 
    WHERE ic.organization_id = o.id AND ic.provider = 'elementor_pro'
);

INSERT INTO integration_connections (
    id,
    organization_id,
    provider,
    status,
    config,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    o.id,
    'three_cx',
    'connected_and_verified',
    jsonb_build_object(
        'pbx_url', 'https://ptp.3cx.com.au:5001',
        'version', 'v20',
        'licence_edition', 'Pro',
        'api_key', 'ptp_3cx_sec_' || encode(gen_random_bytes(16), 'hex'),
        'agent_extensions', jsonb_build_object(
            'ayesha_extension', '101',
            'maryam_extension', '102',
            'jawad_extension', '100',
            'sohail_extension', '103'
        ),
        'features', jsonb_build_object(
            'contact_lookup', true,
            'call_journaling', true,
            'screen_pop', true
        )
    ),
    now(),
    now()
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM integration_connections ic 
    WHERE ic.organization_id = o.id AND ic.provider = 'three_cx'
);

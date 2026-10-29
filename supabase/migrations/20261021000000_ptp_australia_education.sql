-- ==============================================================================
-- Practical Training Pathways CRM — Australia / Education Migration
-- Business: Practical Training Pathways (RTO # 22256)
-- Website: https://www.pracpathways.com.au/
-- Timezone: Australia/Adelaide | Currency: AUD | Locale: en-AU
-- ==============================================================================

-- 1. Create Verified Courses Table
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- e.g. 'CPC40120', 'CPC50220'
    title TEXT NOT NULL,
    delivery_variant TEXT NOT NULL, -- 'Self-Paced Online', 'Blended / Structured Delivery'
    official_url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    short_description TEXT,
    email_information TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_org_course_variant UNIQUE (organization_id, code, delivery_variant)
);

CREATE INDEX IF NOT EXISTS idx_courses_org_active ON courses(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(organization_id, code);

-- 2. Update Organization Defaults to Australia / Adelaide
ALTER TABLE organizations 
    ALTER COLUMN default_timezone SET DEFAULT 'Australia/Adelaide',
    ALTER COLUMN default_currency SET DEFAULT 'AUD';

UPDATE organizations 
SET 
    name = 'Practical Training Pathways',
    slug = 'pracpathways',
    website = 'https://www.pracpathways.com.au',
    default_timezone = 'Australia/Adelaide',
    default_currency = 'AUD',
    email_sender_name = 'Practical Training Pathways Enrolments',
    updated_at = now()
WHERE slug = 'pracpathways' OR id IS NOT NULL;

-- 3. Add Course Interest & Delivery Variant to Contacts and Leads
ALTER TABLE contacts 
    ADD COLUMN IF NOT EXISTS state_or_postcode TEXT,
    ADD COLUMN IF NOT EXISTS course_interest TEXT,
    ADD COLUMN IF NOT EXISTS delivery_variant TEXT,
    ADD COLUMN IF NOT EXISTS course_review_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE lead_submissions 
    ADD COLUMN IF NOT EXISTS state_or_postcode TEXT,
    ADD COLUMN IF NOT EXISTS course_interest TEXT,
    ADD COLUMN IF NOT EXISTS delivery_variant TEXT,
    ADD COLUMN IF NOT EXISTS course_review_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE deals 
    ADD COLUMN IF NOT EXISTS course_code TEXT,
    ADD COLUMN IF NOT EXISTS course_title TEXT,
    ADD COLUMN IF NOT EXISTS delivery_variant TEXT;

-- 4. Enable RLS on courses
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses_org_read" ON courses
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "courses_owner_write" ON courses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.organization_id = courses.organization_id 
            AND profiles.role = 'owner'
        )
    );

-- 5. Data Access Layer Projection: View for Agent Pipeline without financial fields
CREATE OR REPLACE VIEW agent_enquiry_pipeline AS
    SELECT 
        d.id,
        d.organization_id,
        d.contact_id,
        d.assigned_agent_id,
        d.title,
        d.stage,
        d.course_code,
        d.course_title,
        d.delivery_variant,
        d.expected_close_date,
        d.notes,
        d.created_at,
        d.updated_at
    FROM deals d;

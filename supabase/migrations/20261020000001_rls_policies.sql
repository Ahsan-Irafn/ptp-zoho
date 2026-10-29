-- ====================================================================
-- Practical Pathways CRM Row Level Security (RLS) Policies
-- Strict Multi-Tenant Organization and Role Scoping (Owner vs Agent)
-- ====================================================================

-- Helper Functions to read current user profile and role from auth.uid()
CREATE OR REPLACE FUNCTION current_user_profile()
RETURNS profiles AS $$
  SELECT * FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS on all exposed CRM tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppression_records ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- 1. Organizations Policies
-- -------------------------------------------------------------
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id = current_user_org_id());

CREATE POLICY "Only owners can update organization details"
  ON organizations FOR UPDATE
  USING (id = current_user_org_id() AND current_user_role() = 'owner');

-- -------------------------------------------------------------
-- 2. Profiles Policies
-- -------------------------------------------------------------
CREATE POLICY "Users can view all active profiles within their organization"
  ON profiles FOR SELECT
  USING (organization_id = current_user_org_id());

CREATE POLICY "Owners can create and manage team profiles"
  ON profiles FOR ALL
  USING (organization_id = current_user_org_id() AND current_user_role() = 'owner');

CREATE POLICY "Users can update their own profile details"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = current_user_role()); -- Prevent self role elevation

-- -------------------------------------------------------------
-- 3. Invitations Policies (Owner Only)
-- -------------------------------------------------------------
CREATE POLICY "Owners can view and manage organization invitations"
  ON invitations FOR ALL
  USING (organization_id = current_user_org_id() AND current_user_role() = 'owner');

-- -------------------------------------------------------------
-- 4. Contacts Policies (Strict Agent Isolation)
-- -------------------------------------------------------------
-- Owners view all contacts in the org
-- Agents ONLY view contacts assigned to them
CREATE POLICY "Contacts view policy"
  ON contacts FOR SELECT
  USING (
    organization_id = current_user_org_id() AND (
      current_user_role() = 'owner' OR
      assigned_agent_id = auth.uid()
    )
  );

CREATE POLICY "Contacts insert policy"
  ON contacts FOR INSERT
  WITH CHECK (
    organization_id = current_user_org_id()
  );

CREATE POLICY "Contacts update policy"
  ON contacts FOR UPDATE
  USING (
    organization_id = current_user_org_id() AND (
      current_user_role() = 'owner' OR
      assigned_agent_id = auth.uid()
    )
  );

CREATE POLICY "Only owners can delete or merge contacts"
  ON contacts FOR DELETE
  USING (
    organization_id = current_user_org_id() AND
    current_user_role() = 'owner'
  );

-- -------------------------------------------------------------
-- 5. Lead Submissions Policies
-- -------------------------------------------------------------
CREATE POLICY "Lead submissions view policy"
  ON lead_submissions FOR SELECT
  USING (
    organization_id = current_user_org_id() AND (
      current_user_role() = 'owner' OR
      contact_id IN (SELECT id FROM contacts WHERE assigned_agent_id = auth.uid())
    )
  );

-- -------------------------------------------------------------
-- 6. Deals Policies
-- -------------------------------------------------------------
CREATE POLICY "Deals view policy"
  ON deals FOR SELECT
  USING (
    organization_id = current_user_org_id() AND (
      current_user_role() = 'owner' OR
      assigned_agent_id = auth.uid()
    )
  );

CREATE POLICY "Deals modify policy"
  ON deals FOR ALL
  USING (
    organization_id = current_user_org_id() AND (
      current_user_role() = 'owner' OR
      assigned_agent_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- 7. Tasks Policies
-- -------------------------------------------------------------
CREATE POLICY "Tasks view policy"
  ON tasks FOR SELECT
  USING (
    organization_id = current_user_org_id() AND (
      current_user_role() = 'owner' OR
      assigned_agent_id = auth.uid()
    )
  );

CREATE POLICY "Tasks modify policy"
  ON tasks FOR ALL
  USING (
    organization_id = current_user_org_id() AND (
      current_user_role() = 'owner' OR
      assigned_agent_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- 8. Call Logs Policies
-- -------------------------------------------------------------
CREATE POLICY "Call logs view policy"
  ON call_logs FOR SELECT
  USING (
    organization_id = current_user_org_id() AND (
      current_user_role() = 'owner' OR
      agent_id = auth.uid() OR
      contact_id IN (SELECT id FROM contacts WHERE assigned_agent_id = auth.uid())
    )
  );

CREATE POLICY "Agents and owners can insert call logs"
  ON call_logs FOR INSERT
  WITH CHECK (
    organization_id = current_user_org_id() AND
    agent_id = auth.uid()
  );

-- -------------------------------------------------------------
-- 9. Notes Policies
-- -------------------------------------------------------------
CREATE POLICY "Notes view policy"
  ON notes FOR SELECT
  USING (
    organization_id = current_user_org_id() AND (
      current_user_role() = 'owner' OR
      contact_id IN (SELECT id FROM contacts WHERE assigned_agent_id = auth.uid())
    )
  );

CREATE POLICY "Notes create policy"
  ON notes FOR INSERT
  WITH CHECK (
    organization_id = current_user_org_id() AND
    author_id = auth.uid()
  );

-- -------------------------------------------------------------
-- 10. Email Templates Policies
-- -------------------------------------------------------------
CREATE POLICY "All authenticated users can view active email templates"
  ON email_templates FOR SELECT
  USING (organization_id = current_user_org_id() AND is_active = true);

CREATE POLICY "Owners can manage email templates"
  ON email_templates FOR ALL
  USING (organization_id = current_user_org_id() AND current_user_role() = 'owner');

-- -------------------------------------------------------------
-- 11. Audit Events Policies (Owner Only)
-- -------------------------------------------------------------
CREATE POLICY "Only owners can view audit events"
  ON audit_events FOR SELECT
  USING (organization_id = current_user_org_id() AND current_user_role() = 'owner');

-- -------------------------------------------------------------
-- 12. Integration Connections & Secrets (Owner Only)
-- -------------------------------------------------------------
CREATE POLICY "Only owners can view and manage integration credentials"
  ON integration_connections FOR ALL
  USING (organization_id = current_user_org_id() AND current_user_role() = 'owner');

-- -------------------------------------------------------------
-- 13. Notifications Policies
-- -------------------------------------------------------------
CREATE POLICY "Users can view and update their own notifications"
  ON notifications FOR ALL
  USING (user_id = auth.uid());

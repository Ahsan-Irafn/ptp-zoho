-- ====================================================================
-- Practical Pathways CRM Database Functions, Triggers & Invariants
-- Round-Robin Assignment, Timestamps, and Last Owner Protection
-- ====================================================================

-- 1. Auto-updated timestamp trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER set_timestamp_organizations
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_profiles
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_contacts
BEFORE UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_deals
BEFORE UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_tasks
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_notes
BEFORE UPDATE ON notes
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_templates
BEFORE UPDATE ON email_templates
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_jobs
BEFORE UPDATE ON job_queue
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 2. Invariant: Prevent removing or disabling the last active owner
CREATE OR REPLACE FUNCTION check_last_owner_invariant()
RETURNS TRIGGER AS $$
DECLARE
  active_owner_count INT;
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner') OR 
     (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND (NEW.role != 'owner' OR NEW.is_active = false)) THEN
    SELECT COUNT(*) INTO active_owner_count 
    FROM profiles 
    WHERE organization_id = OLD.organization_id 
      AND role = 'owner' 
      AND is_active = true 
      AND id != OLD.id;
      
    IF active_owner_count < 1 THEN
      RAISE EXCEPTION 'Cannot remove or disable the last active owner of the organization.';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_last_owner
BEFORE UPDATE OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION check_last_owner_invariant();

-- 3. Atomic Round-Robin Agent Selector
-- Rotates sequentially across active calling agents in the organization
CREATE OR REPLACE FUNCTION get_next_round_robin_agent(p_org_id UUID)
RETURNS UUID AS $$
DECLARE
  v_agent_ids UUID[];
  v_total_agents INT;
  v_current_index INT;
  v_next_agent_id UUID;
BEGIN
  -- Fetch sorted list of all active agents
  SELECT array_agg(id ORDER BY created_at ASC) INTO v_agent_ids
  FROM profiles
  WHERE organization_id = p_org_id 
    AND role = 'agent' 
    AND is_active = true;

  v_total_agents := array_length(v_agent_ids, 1);

  -- If no active agents exist, return NULL (enquiry goes to unassigned queue)
  IF v_total_agents IS NULL OR v_total_agents = 0 THEN
    RETURN NULL;
  END IF;

  -- Lock organization record for atomic index progression
  SELECT round_robin_index INTO v_current_index
  FROM organizations
  WHERE id = p_org_id
  FOR UPDATE;

  -- 1-based indexing in PostgreSQL arrays
  v_next_agent_id := v_agent_ids[(v_current_index % v_total_agents) + 1];

  -- Update index for next time
  UPDATE organizations 
  SET round_robin_index = (v_current_index + 1) % v_total_agents
  WHERE id = p_org_id;

  RETURN v_next_agent_id;
END;
$$ LANGUAGE plpgsql;

-- Migration 051: Immutable Server-Side Audit Triggers
-- NZT-48 Part 3: Migrating critical audit logs from client-side API calls to PgSQL Triggers
-- This guarantees audit trails cannot be forged or bypassed by the client application.

-- 1. Helper function to get current user name if available
CREATE OR REPLACE FUNCTION get_auth_user_name()
RETURNS TEXT AS $$
DECLARE
  v_name TEXT;
BEGIN
  -- Attempt to get full name from public profiles based on auth.uid()
  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  IF v_name IS NULL THEN
    RETURN 'Authenticated User';
  END IF;
  RETURN v_name;
EXCEPTION WHEN OTHERS THEN
  RETURN 'System';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Master generic audit trigger function
CREATE OR REPLACE FUNCTION log_immutable_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_name TEXT;
  v_action TEXT;
  v_details JSONB;
  v_uid UUID;
  v_username TEXT;
  v_new_json JSONB;
  v_old_json JSONB;
BEGIN
  v_entity_type := TG_ARGV[0];
  v_uid := auth.uid();
  v_username := get_auth_user_name();
  
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_new_json := to_jsonb(NEW);
    v_entity_name := COALESCE(v_new_json->>'name', v_new_json->>'title', v_new_json->>'id');
  END IF;
  
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    IF TG_OP = 'DELETE' THEN
      v_entity_name := COALESCE(v_old_json->>'name', v_old_json->>'title', v_old_json->>'id');
    END IF;
  END IF;

  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := v_entity_type || '_CREATED';
    v_details := jsonb_build_object('new_data', v_new_json);
    
    INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_type, entity_id, details, created_at)
    VALUES ('audit-' || extract(epoch from now())::text || '-' || substr(md5(random()::text), 1, 9), v_uid, v_username, v_action, v_entity_name, v_entity_type, v_new_json->>'id', v_details, now());
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF v_old_json IS DISTINCT FROM v_new_json THEN
      v_action := v_entity_type || '_UPDATED';
      
      -- Special case for statuses
      IF v_old_json->>'status' IS DISTINCT FROM v_new_json->>'status' THEN
         v_action := v_entity_type || '_STATUS_CHANGED';
      END IF;

      v_details := jsonb_build_object('old_data', v_old_json, 'new_data', v_new_json);
      
      INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_type, entity_id, details, created_at)
      VALUES ('audit-' || extract(epoch from now())::text || '-' || substr(md5(random()::text), 1, 9), v_uid, v_username, v_action, v_entity_name, v_entity_type, v_new_json->>'id', v_details, now());
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := v_entity_type || '_DELETED';
    v_details := jsonb_build_object('old_data', v_old_json);
    
    INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_type, entity_id, details, created_at)
    VALUES ('audit-' || extract(epoch from now())::text || '-' || substr(md5(random()::text), 1, 9), v_uid, v_username, v_action, v_entity_name, v_entity_type, v_old_json->>'id', v_details, now());
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply triggers to critical operational tables

-- Projects table (tracks overall scope and activation)
DROP TRIGGER IF EXISTS trg_audit_projects ON projects;
CREATE TRIGGER trg_audit_projects
  AFTER INSERT OR UPDATE OF status, budget, end_date OR DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION log_immutable_audit('PROJECT');

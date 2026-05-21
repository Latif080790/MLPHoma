-- Migration 076: Approval Chains and Delegation
-- Adds configurable multi-step approval workflow templates (approval_chains)
-- and out-of-office delegation support (approval_delegates).
-- Also links approval_requests to a specific chain via chain_id.
-- RLS follows the is_project_member_by_text() pattern from migration 074.
-- updated_at trigger reuses update_updated_at_column() from migration 003.

-- ============================================================
-- 1. approval_chains — configurable workflow templates per project
-- ============================================================

CREATE TABLE IF NOT EXISTS public.approval_chains (
  id            TEXT PRIMARY KEY DEFAULT 'chain-' || gen_random_uuid()::TEXT,
  project_id    TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL,
  -- entity_type matches approval_requests.entity_type values:
  -- PURCHASE_ORDER, MATERIAL_TRANSFER, BUDGET_OVERRIDE, BUDGET_TRANSFER,
  -- PAYMENT, CHANGE_ORDER, EMERGENCY_TRANSFER, PROGRESS_CLAIM, BUDGET_REVISION
  name          TEXT NOT NULL,
  -- steps: array of approval step descriptors.
  -- Each element: { "order": int, "approver_role": text,
  --                 "amount_min": numeric|null, "amount_max": numeric|null,
  --                 "parallel_group": int|null }
  steps         JSONB NOT NULL DEFAULT '[]',
  escalation_hours INT NOT NULL DEFAULT 24,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_approval_chains_project
  ON public.approval_chains(project_id, is_active);

CREATE INDEX IF NOT EXISTS idx_approval_chains_entity_type
  ON public.approval_chains(project_id, entity_type, is_active);

-- ============================================================
-- 2. approval_delegates — out-of-office delegation
-- ============================================================

CREATE TABLE IF NOT EXISTS public.approval_delegates (
  id            TEXT PRIMARY KEY DEFAULT 'delg-' || gen_random_uuid()::TEXT,
  project_id    TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  delegator_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delegate_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Empty array = all entity types; specific values = only those types
  entity_types  TEXT[] NOT NULL DEFAULT '{}',
  valid_from    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until   TIMESTAMPTZ NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for delegation lookup and expiry management
CREATE INDEX IF NOT EXISTS idx_approval_delegates_delegator
  ON public.approval_delegates(delegator_id, is_active);

CREATE INDEX IF NOT EXISTS idx_approval_delegates_project
  ON public.approval_delegates(project_id, is_active);

CREATE INDEX IF NOT EXISTS idx_approval_delegates_validity
  ON public.approval_delegates(delegator_id, valid_from, valid_until)
  WHERE is_active = TRUE;

-- ============================================================
-- 3. Add chain_id FK column to approval_requests
-- ============================================================

ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS chain_id TEXT REFERENCES public.approval_chains(id);

CREATE INDEX IF NOT EXISTS idx_approval_requests_chain
  ON public.approval_requests(chain_id)
  WHERE chain_id IS NOT NULL;

-- ============================================================
-- 4. updated_at trigger for approval_chains
--    Reuses update_updated_at_column() defined in migration 003
-- ============================================================

DROP TRIGGER IF EXISTS trg_approval_chains_updated_at ON public.approval_chains;
CREATE TRIGGER trg_approval_chains_updated_at
  BEFORE UPDATE ON public.approval_chains
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. RLS — approval_chains
-- ============================================================

ALTER TABLE public.approval_chains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approval_chains_select ON public.approval_chains;
CREATE POLICY approval_chains_select
  ON public.approval_chains
  FOR SELECT
  USING (
    project_id IS NULL
    OR is_project_member_by_text(project_id)
  );

DROP POLICY IF EXISTS approval_chains_insert ON public.approval_chains;
CREATE POLICY approval_chains_insert
  ON public.approval_chains
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      project_id IS NULL
      OR is_project_member_by_text(project_id)
    )
  );

DROP POLICY IF EXISTS approval_chains_update ON public.approval_chains;
CREATE POLICY approval_chains_update
  ON public.approval_chains
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      project_id IS NULL
      OR is_project_member_by_text(project_id)
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      project_id IS NULL
      OR is_project_member_by_text(project_id)
    )
  );

DROP POLICY IF EXISTS approval_chains_delete ON public.approval_chains;
CREATE POLICY approval_chains_delete
  ON public.approval_chains
  FOR DELETE
  USING (
    -- Only the creator or a project member with admin rights can delete
    auth.uid() = created_by
    OR (
      project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- ============================================================
-- 6. RLS — approval_delegates
-- ============================================================

ALTER TABLE public.approval_delegates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approval_delegates_select ON public.approval_delegates;
CREATE POLICY approval_delegates_select
  ON public.approval_delegates
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Delegator can see their own delegations
      delegator_id = auth.uid()
      -- Delegate can see delegations assigned to them
      OR delegate_id = auth.uid()
      -- Project members can see delegations for their project
      OR (
        project_id IS NOT NULL
        AND is_project_member_by_text(project_id)
      )
    )
  );

DROP POLICY IF EXISTS approval_delegates_insert ON public.approval_delegates;
CREATE POLICY approval_delegates_insert
  ON public.approval_delegates
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    -- Only the delegator themselves (or admin) can create a delegation on their behalf
    AND (
      delegator_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS approval_delegates_update ON public.approval_delegates;
CREATE POLICY approval_delegates_update
  ON public.approval_delegates
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      delegator_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      delegator_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS approval_delegates_delete ON public.approval_delegates;
CREATE POLICY approval_delegates_delete
  ON public.approval_delegates
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND (
      delegator_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- ============================================================
-- 7. RPC: rpc_get_active_delegate
--    Returns the delegate_id for a delegator if an active,
--    currently-valid delegation exists for the given entity type.
--    Returns NULL if no active delegation is found.
--    Used by approvalService to route notifications correctly.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_get_active_delegate(
  p_delegator_id  UUID,
  p_entity_type   TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delegate_id UUID;
BEGIN
  SELECT delegate_id
  INTO v_delegate_id
  FROM public.approval_delegates
  WHERE
    delegator_id = p_delegator_id
    AND is_active = TRUE
    AND valid_from <= NOW()
    AND valid_until > NOW()
    -- Empty entity_types array means "all types"; otherwise check membership
    AND (
      array_length(entity_types, 1) IS NULL
      OR entity_types = '{}'
      OR p_entity_type = ANY(entity_types)
    )
  ORDER BY valid_from DESC
  LIMIT 1;

  RETURN v_delegate_id;  -- NULL if no active delegation found
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_active_delegate(UUID, TEXT) TO authenticated;

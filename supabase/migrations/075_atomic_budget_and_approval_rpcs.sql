-- Migration 075: Atomic Budget Check+Commit and Approval RPCs
-- Fixes:
--   BUDGET-01: Race condition in commitBudget() / checkBudgetAvailability()
--   APPROVAL-02: Race condition when two approvers click simultaneously
--   APPROVAL-01: Adds SLA deadline + ESCALATED status for timeout escalation
-- Apply via: supabase db push OR paste into Supabase SQL Editor

-- ============================================================
-- 1. FIX approval_requests: add SLA + ESCALATED status
-- ============================================================

-- Add sla_deadline column (when approval request expires/escalates)
ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_hours INT DEFAULT 24,
  ADD COLUMN IF NOT EXISTS assigned_approver_id UUID REFERENCES auth.users(id);

-- Extend status to include ESCALATED (approved_requests.status CHECK constraint)
-- First drop existing CHECK constraint, then re-add with ESCALATED
ALTER TABLE approval_requests DROP CONSTRAINT IF EXISTS approval_requests_status_check;
ALTER TABLE approval_requests
  ADD CONSTRAINT approval_requests_status_check
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED'));

-- Extend approver_role to include 'supervisor', 'director' (matches approvalService smart routing)
ALTER TABLE approval_requests DROP CONSTRAINT IF EXISTS approval_requests_approver_role_check;
ALTER TABLE approval_requests
  ADD CONSTRAINT approval_requests_approver_role_check
  CHECK (approver_role IN ('supervisor', 'manager', 'admin', 'director'));

-- Extend entity_type to include PROGRESS_CLAIM (for billing approval workflow)
ALTER TABLE approval_requests DROP CONSTRAINT IF EXISTS approval_requests_entity_type_check;
ALTER TABLE approval_requests
  ADD CONSTRAINT approval_requests_entity_type_check
  CHECK (entity_type IN (
    'PURCHASE_ORDER',
    'MATERIAL_TRANSFER',
    'BUDGET_OVERRIDE',
    'BUDGET_TRANSFER',
    'PAYMENT',
    'CHANGE_ORDER',
    'EMERGENCY_TRANSFER',
    'PROGRESS_CLAIM',
    'BUDGET_REVISION'
  ));

-- Index for SLA queries (find overdue PENDING approvals)
CREATE INDEX IF NOT EXISTS idx_approval_requests_sla
  ON approval_requests(status, sla_deadline)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_approval_requests_assigned
  ON approval_requests(assigned_approver_id, status)
  WHERE assigned_approver_id IS NOT NULL;

-- ============================================================
-- 2. RPC: rpc_approve_request — atomic approval with row lock
-- Fixes APPROVAL-02: prevents double-approve race condition
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_approve_request(
  p_approval_id  TEXT,
  p_approver_id  UUID,
  p_approver_name TEXT,
  p_notes        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row approval_requests;
BEGIN
  -- Acquire row-level lock — second concurrent call will wait until first completes
  SELECT * INTO v_row
  FROM approval_requests
  WHERE id = p_approval_id
  FOR UPDATE;

  -- Guard: only PENDING can be approved
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Approval request not found');
  END IF;

  IF v_row.status != 'PENDING' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Cannot approve: request is already %s', v_row.status)
    );
  END IF;

  -- Perform the approval
  UPDATE approval_requests SET
    status        = 'APPROVED',
    approved_by   = p_approver_id,
    approver_name = p_approver_name,
    approved_at   = NOW(),
    notes         = p_notes,
    updated_at    = NOW()
  WHERE id = p_approval_id;

  RETURN jsonb_build_object(
    'success',        true,
    'approvalId',     p_approval_id,
    'entityType',     v_row.entity_type,
    'entityId',       v_row.entity_id,
    'projectId',      v_row.project_id,
    'requesterId',    v_row.requester_id,
    'requesterName',  v_row.requester_name,
    'title',          v_row.title,
    'impactSummary',  v_row.impact_summary
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION rpc_approve_request(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 3. RPC: rpc_reject_request — atomic rejection with row lock
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_reject_request(
  p_approval_id      TEXT,
  p_approver_id      UUID,
  p_approver_name    TEXT,
  p_rejection_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row approval_requests;
BEGIN
  SELECT * INTO v_row
  FROM approval_requests
  WHERE id = p_approval_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Approval request not found');
  END IF;

  IF v_row.status != 'PENDING' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Cannot reject: request is already %s', v_row.status)
    );
  END IF;

  UPDATE approval_requests SET
    status           = 'REJECTED',
    approved_by      = p_approver_id,
    approver_name    = p_approver_name,
    rejection_reason = p_rejection_reason,
    updated_at       = NOW()
  WHERE id = p_approval_id;

  RETURN jsonb_build_object(
    'success',        true,
    'approvalId',     p_approval_id,
    'entityType',     v_row.entity_type,
    'entityId',       v_row.entity_id,
    'projectId',      v_row.project_id,
    'requesterId',    v_row.requester_id,
    'requesterName',  v_row.requester_name,
    'title',          v_row.title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_reject_request(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 4. RPC: rpc_check_and_commit_budget — atomic budget lock
-- Fixes BUDGET-01: prevents double-spend race condition
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_check_and_commit_budget(
  p_rap_item_id  TEXT,
  p_amount       NUMERIC,
  p_po_id        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rap          RECORD;
  v_total_budget NUMERIC;
  v_remaining    NUMERIC;
BEGIN
  -- Acquire row-level lock on this RAP item
  -- Prevents concurrent PO creation from reading stale committed_cost
  SELECT
    id,
    qty_budget,
    unit_price_budget,
    committed_cost,
    actual_cost
  INTO v_rap
  FROM rap_items
  WHERE id = p_rap_item_id
  FOR UPDATE;

  IF v_rap.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('RAP item not found: %s', p_rap_item_id)
    );
  END IF;

  v_total_budget := COALESCE(v_rap.qty_budget, 0) * COALESCE(v_rap.unit_price_budget, 0);
  v_remaining    := v_total_budget
                    - COALESCE(v_rap.committed_cost, 0)
                    - COALESCE(v_rap.actual_cost, 0);

  -- Check if requested amount fits within remaining budget
  IF p_amount > v_remaining THEN
    RETURN jsonb_build_object(
      'success',       false,
      'error',         'Budget exceeded',
      'totalBudget',   v_total_budget,
      'committed',     COALESCE(v_rap.committed_cost, 0),
      'actual',        COALESCE(v_rap.actual_cost, 0),
      'remaining',     v_remaining,
      'requested',     p_amount,
      'overageAmount', p_amount - v_remaining
    );
  END IF;

  -- Atomically increment committed_cost
  UPDATE rap_items
  SET committed_cost = COALESCE(committed_cost, 0) + p_amount
  WHERE id = p_rap_item_id;

  RETURN jsonb_build_object(
    'success',      true,
    'rapItemId',    p_rap_item_id,
    'committed',    COALESCE(v_rap.committed_cost, 0) + p_amount,
    'remaining',    v_remaining - p_amount,
    'totalBudget',  v_total_budget
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_check_and_commit_budget(TEXT, NUMERIC, TEXT) TO authenticated;

-- ============================================================
-- 5. RPC: rpc_release_budget — atomic budget release
-- Used when PO is cancelled after budget was committed
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_release_budget(
  p_rap_item_id TEXT,
  p_amount      NUMERIC,
  p_po_id       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rap RECORD;
BEGIN
  SELECT id, committed_cost
  INTO v_rap
  FROM rap_items
  WHERE id = p_rap_item_id
  FOR UPDATE;

  IF v_rap.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'RAP item not found');
  END IF;

  UPDATE rap_items
  SET committed_cost = GREATEST(0, COALESCE(committed_cost, 0) - p_amount)
  WHERE id = p_rap_item_id;

  RETURN jsonb_build_object(
    'success',   true,
    'rapItemId', p_rap_item_id,
    'released',  p_amount,
    'newCommitted', GREATEST(0, COALESCE(v_rap.committed_cost, 0) - p_amount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_release_budget(TEXT, NUMERIC, TEXT) TO authenticated;

-- ============================================================
-- 6. Auto-set sla_deadline on new approval_requests
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_approval_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sla_deadline IS NULL AND NEW.sla_hours IS NOT NULL THEN
    NEW.sla_deadline := NOW() + (NEW.sla_hours || ' hours')::INTERVAL;
  ELSIF NEW.sla_deadline IS NULL THEN
    -- Default 24-hour SLA
    NEW.sla_deadline := NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_approval_sla ON approval_requests;
CREATE TRIGGER trg_set_approval_sla
  BEFORE INSERT ON approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_approval_sla();

-- ============================================================
-- 7. pg_cron job: escalate overdue approvals every hour
-- Requires pg_cron extension (available in Supabase)
-- Note: run manually if pg_cron is not enabled:
--   SELECT cron.schedule(...)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove existing job if any (silently ignore if not found)
    BEGIN
      PERFORM cron.unschedule('approval-sla-escalation');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Schedule escalation check every hour
    PERFORM cron.schedule(
      'approval-sla-escalation',
      '0 * * * *',
      $cron$
        UPDATE approval_requests
        SET
          status     = 'ESCALATED',
          updated_at = NOW()
        WHERE
          status       = 'PENDING'
          AND sla_deadline IS NOT NULL
          AND sla_deadline < NOW();
      $cron$
    );
  END IF;
END;
$$;

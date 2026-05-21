-- Migration 077: Push Subscriptions table for Web Push (VAPID)
-- Stores browser push subscription objects per user.
-- Apply via: supabase db push OR paste into Supabase SQL Editor

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id            TEXT PRIMARY KEY DEFAULT ('push-' || gen_random_uuid()::text),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint      TEXT NOT NULL,
    keys_p256dh   TEXT NOT NULL,
    keys_auth     TEXT NOT NULL,
    user_agent    TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Prevent duplicate registrations for the same endpoint
    UNIQUE (user_id, endpoint)
);

-- Index for fast lookup during push dispatch
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions(user_id, is_active)
    WHERE is_active = true;

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own subscriptions
CREATE POLICY "push_subscriptions_select_own"
    ON push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_insert_own"
    ON push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_update_own"
    ON push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_delete_own"
    ON push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION fn_push_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION fn_push_subscriptions_updated_at();

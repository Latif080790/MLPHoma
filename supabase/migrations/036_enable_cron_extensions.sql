-- Migration: 036_enable_cron_extensions.sql
-- Purpose: Enable extensions required for scheduling cron jobs via Database
--          Note: You must run this using a Superuser role (postgres) or via Dashboard SQL Editor.

-- 1. Enable pg_net (for making HTTP requests to Edge Functions)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Enable pg_cron (for scheduling the requests)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Note: Actual scheduling requires your Service Role Key, so it's best run manually
-- See walkthrough.md for the scheduling command.

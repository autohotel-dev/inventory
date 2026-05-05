-- Migration: Setup pg_cron for telemetry cleanup
-- Author: Antigravity

-- Enable pg_cron if not already enabled (Requires superuser, but in Supabase it's supported for the postgres role)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to delete old telemetry
CREATE OR REPLACE FUNCTION public.cleanup_old_telemetry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.system_telemetry 
    WHERE created_at < NOW() - INTERVAL '3 months';
END;
$$;

-- Schedule the cleanup to run every day at 3 AM
-- Using IF NOT EXISTS logic for the cron job is tricky, so we just unschedule first
SELECT cron.unschedule('cleanup-telemetry-job');

SELECT cron.schedule(
    'cleanup-telemetry-job',
    '0 3 * * *', -- Every day at 3:00 AM
    'SELECT public.cleanup_old_telemetry()'
);

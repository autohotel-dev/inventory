-- Migration: Create system_telemetry table for global tracking
-- Author: Antigravity

CREATE TABLE IF NOT EXISTS public.system_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    module TEXT,
    page TEXT,
    action_type TEXT NOT NULL CHECK (action_type IN ('UI_CLICK', 'API_REQUEST', 'PAGE_VIEW')),
    action_name TEXT,
    duration_ms INTEGER,
    payload JSONB,
    endpoint TEXT,
    is_success BOOLEAN,
    error_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for fast filtering
CREATE INDEX IF NOT EXISTS idx_system_telemetry_created_at ON public.system_telemetry(created_at);
CREATE INDEX IF NOT EXISTS idx_system_telemetry_user_id ON public.system_telemetry(user_id);
CREATE INDEX IF NOT EXISTS idx_system_telemetry_action_type ON public.system_telemetry(action_type);
CREATE INDEX IF NOT EXISTS idx_system_telemetry_module ON public.system_telemetry(module);

-- Enable RLS
ALTER TABLE public.system_telemetry ENABLE ROW LEVEL SECURITY;

-- Insert policy (anyone can insert via API or service role, but users can only insert their own if authenticated, 
-- or we can just allow insert for authenticated users, but it's better to manage via backend API route)
-- Since we use a backend API route (Next.js server), the Service Role will bypass RLS.
-- However, we'll allow authenticated users to insert if we ever need direct insert from client.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'system_telemetry' AND policyname = 'Allow insert for authenticated users'
    ) THEN
        CREATE POLICY "Allow insert for authenticated users" 
        ON public.system_telemetry 
        FOR INSERT 
        TO authenticated 
        WITH CHECK (true);
    END IF;
END $$;

-- Read policy (only admins or service role)
-- Assuming roles table handles admins, but service role bypasses. For now, no read access for normal users.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'system_telemetry' AND policyname = 'Allow read for admins'
    ) THEN
        CREATE POLICY "Allow read for admins" 
        ON public.system_telemetry 
        FOR SELECT 
        TO authenticated 
        USING (
            EXISTS (
                SELECT 1 FROM public.employees e
                JOIN public.roles r ON e.role_id = r.id
                WHERE e.auth_user_id = auth.uid() AND r.name = 'admin'
            )
        );
    END IF;
END $$;

-- Note on cleanup: 
-- In the future, a pg_cron task could be added or a background job 
-- to DELETE FROM system_telemetry WHERE created_at < NOW() - INTERVAL '3 months';

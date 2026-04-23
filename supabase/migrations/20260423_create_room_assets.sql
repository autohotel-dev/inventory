-- Migration: Create Room Assets Tracking Tables
-- Purpose: Track physical assets (like TV remotes) per room to ensure chain of custody.

CREATE TABLE IF NOT EXISTS public.room_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL, -- e.g., 'TV_REMOTE', 'AC_REMOTE'
    status TEXT NOT NULL DEFAULT 'EN_HABITACION', -- 'EN_RECEPCION', 'CON_COCHERO', 'EN_HABITACION', 'EXTRAVIADO'
    assigned_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, asset_type)
);

CREATE TABLE IF NOT EXISTS public.room_asset_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.room_assets(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL, -- Who made the change or is responsible
    action_type TEXT NOT NULL, -- e.g., 'ASSIGNED_TO_COCHERO', 'DROPPED_IN_ROOM', 'VERIFIED_IN_ROOM', 'MARKED_MISSING'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to automatically update 'updated_at' on room_assets
CREATE OR REPLACE FUNCTION update_room_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_room_assets_updated_at ON public.room_assets;
CREATE TRIGGER update_room_assets_updated_at
    BEFORE UPDATE ON public.room_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_room_assets_updated_at();

-- Insert initial records for existing rooms (assume they all have a TV remote in the room initially)
INSERT INTO public.room_assets (room_id, asset_type, status)
SELECT id, 'TV_REMOTE', 'EN_HABITACION'
FROM public.rooms
ON CONFLICT (room_id, asset_type) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.room_assets TO authenticated;
GRANT SELECT, INSERT ON public.room_asset_logs TO authenticated;

-- Set up RLS
ALTER TABLE public.room_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_asset_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access to room_assets"
    ON public.room_assets FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated update access to room_assets"
    ON public.room_assets FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert access to room_assets"
    ON public.room_assets FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated read access to room_asset_logs"
    ON public.room_asset_logs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert access to room_asset_logs"
    ON public.room_asset_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

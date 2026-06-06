-- Add door_opened_at column to track when a door was physically opened
-- This allows the frontend to show accurate "time open" even after page reload

ALTER TABLE public.sensors
  ADD COLUMN IF NOT EXISTS door_opened_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.sensors.door_opened_at IS
  'Timestamp when the door was last opened. Set on is_open=true, cleared on is_open=false.';

-- Trigger function: automatically set/clear door_opened_at when is_open changes
CREATE OR REPLACE FUNCTION public.track_door_open_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_open = TRUE AND (OLD.is_open = FALSE OR OLD.is_open IS NULL) THEN
    -- Door just opened — record timestamp
    NEW.door_opened_at := NOW();
  ELSIF NEW.is_open = FALSE AND OLD.is_open = TRUE THEN
    -- Door just closed — clear timestamp
    NEW.door_opened_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_track_door_open ON public.sensors;
CREATE TRIGGER trigger_track_door_open
  BEFORE UPDATE OF is_open ON public.sensors
  FOR EACH ROW
  EXECUTE FUNCTION public.track_door_open_timestamp();

-- Backfill: set door_opened_at for currently open doors
UPDATE public.sensors
  SET door_opened_at = COALESCE(last_seen, NOW())
  WHERE is_open = TRUE AND door_opened_at IS NULL;

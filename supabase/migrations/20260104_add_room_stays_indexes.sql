-- Fix #14: Add Index on room_stays.status for Performance
-- This index improves query performance for filtering by status (ACTIVA, FINALIZADA, etc.)

CREATE INDEX IF NOT EXISTS idx_room_stays_status 
ON room_stays(status);

-- Also add composite index for common query pattern (status + room_id)
CREATE INDEX IF NOT EXISTS idx_room_stays_status_room 
ON room_stays(status, room_id);

COMMENT ON INDEX idx_room_stays_status IS 'Performance optimization for status filtering';
COMMENT ON INDEX idx_room_stays_status_room IS 'Performance optimization for room-specific status queries';

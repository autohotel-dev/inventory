-- Add column to track valet-initiated checkout requests
ALTER TABLE room_stays 
ADD COLUMN valet_checkout_requested_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for performance in dashboard queries
CREATE INDEX idx_room_stays_valet_checkout_requested ON room_stays(valet_checkout_requested_at) 
WHERE valet_checkout_requested_at IS NOT NULL;

COMMENT ON COLUMN room_stays.valet_checkout_requested_at IS 'Timestamp when valet notified that guest is leaving (proposing checkout)';

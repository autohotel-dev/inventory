-- Add column to track vehicle requests
ALTER TABLE room_stays 
ADD COLUMN vehicle_requested_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for performance in dashboard queries
CREATE INDEX idx_room_stays_vehicle_requested ON room_stays(vehicle_requested_at) 
WHERE vehicle_requested_at IS NOT NULL;

COMMENT ON COLUMN room_stays.vehicle_requested_at IS 'Timestamp when reception requested the vehicle (Valet functionality)';

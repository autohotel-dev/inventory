-- Create sensors table
CREATE TABLE IF NOT EXISTS sensors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    device_id TEXT NOT NULL UNIQUE, -- Tuya Device ID
    name TEXT NOT NULL,
    status TEXT CHECK (status IN ('ONLINE', 'OFFLINE')),
    is_open BOOLEAN DEFAULT FALSE,
    battery_level INTEGER,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sensor_events table for history
CREATE TABLE IF NOT EXISTS sensor_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id UUID REFERENCES sensors(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'OPEN', 'CLOSE', 'BATTERY', 'STATUS'
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_events ENABLE ROW LEVEL SECURITY;

-- Policies for sensors
CREATE POLICY "Enable read access for authenticated users" ON sensors
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert/update for authenticated users" ON sensors
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policies for sensor_events
CREATE POLICY "Enable read access for authenticated users" ON sensor_events
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON sensor_events
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Realtime publication
-- Add tables to realtime publication if it exists, otherwise create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE sensors;
  ELSE
    ALTER PUBLICATION supabase_realtime ADD TABLE sensors;
  END IF;
END
$$;

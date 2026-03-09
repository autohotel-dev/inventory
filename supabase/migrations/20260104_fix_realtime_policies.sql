-- ================================================================
-- FIX: Enable RLS Policies for Realtime
-- Description: Explicitly allow SELECT on tables needed for Realtime
-- ================================================================

-- 1. ROOMS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON rooms;
CREATE POLICY "Enable read access for all users" ON rooms
    FOR SELECT
    USING (true); -- Allow everyone (anon + authenticated) to read

-- 2. ROOM_STAYS
ALTER TABLE room_stays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON room_stays;
CREATE POLICY "Enable read access for all users" ON room_stays
    FOR SELECT
    USING (true);

-- 3. PAYMENTS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON payments;
CREATE POLICY "Enable read access for all users" ON payments
    FOR SELECT
    USING (true);

-- 4. Re-verify Publication
ALTER PUBLICATION supabase_realtime ADD TABLE rooms, room_stays, payments;

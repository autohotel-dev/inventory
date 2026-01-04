-- ================================================================
-- FIX: Enable RLS Policies and Reset Publication
-- Description: Sets policies and forces publication state without errors
-- ================================================================

-- 1. Policies (Safe to run multiple times)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON rooms;
CREATE POLICY "Enable read access for all users" ON rooms FOR SELECT USING (true);

ALTER TABLE room_stays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON room_stays;
CREATE POLICY "Enable read access for all users" ON room_stays FOR SELECT USING (true);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON payments;
CREATE POLICY "Enable read access for all users" ON payments FOR SELECT USING (true);

-- 2. Publication (Using SET to avoid "already member" error)
-- This resets the publication to include EXACTLY these tables.
ALTER PUBLICATION supabase_realtime SET TABLE rooms, room_stays, payments;

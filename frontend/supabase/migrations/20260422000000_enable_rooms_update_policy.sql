-- ================================================================
-- MIGRATION: Add UPDATE policy for rooms
-- Description: Allows authenticated users (like camaristas) to update room status from the mobile app
-- ================================================================

-- Add policy to allow authenticated users to update rooms
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.rooms;

CREATE POLICY "Enable update access for authenticated users" 
ON public.rooms 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

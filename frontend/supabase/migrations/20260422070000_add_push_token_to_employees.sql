-- ================================================================
-- MIGRATION: Add push_token to employees
-- Description: Adds a push_token column to store Expo Push Tokens
-- ================================================================

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Update RLS policies to allow employees to update their own push_token
CREATE POLICY "Allow employees to update their own push_token"
ON public.employees
FOR UPDATE
USING (auth_user_id = auth.uid() OR id IN (
  -- In case they update by employee id
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
))
WITH CHECK (auth_user_id = auth.uid() OR id IN (
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
));

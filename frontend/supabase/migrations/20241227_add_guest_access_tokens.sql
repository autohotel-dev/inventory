-- Migration: Add Guest Access Tokens to Room Stays
-- Created: 2025-12-27
-- Purpose: Enable secure token-based access to guest portal

-- Add guest_access_token column to room_stays
ALTER TABLE room_stays 
ADD COLUMN IF NOT EXISTS guest_access_token TEXT UNIQUE;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_room_stays_guest_token 
ON room_stays(guest_access_token) 
WHERE guest_access_token IS NOT NULL;

-- Function to generate a secure random token
CREATE OR REPLACE FUNCTION generate_guest_access_token()
RETURNS TEXT AS $$
BEGIN
  -- Generate a 64-character hex token (32 bytes)
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to automatically generate token for new active room stays
CREATE OR REPLACE FUNCTION auto_generate_guest_token()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate token for ACTIVA status and if not already set
  IF NEW.status = 'ACTIVA' AND NEW.guest_access_token IS NULL THEN
    NEW.guest_access_token = generate_guest_access_token();
  END IF;
  
  -- Clear token when room stay is no longer active
  IF NEW.status != 'ACTIVA' AND OLD.status = 'ACTIVA' THEN
    NEW.guest_access_token = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate tokens
DROP TRIGGER IF EXISTS trigger_auto_generate_guest_token ON room_stays;
CREATE TRIGGER trigger_auto_generate_guest_token
  BEFORE INSERT OR UPDATE ON room_stays
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_guest_token();

-- Generate tokens for existing active room stays
UPDATE room_stays 
SET guest_access_token = generate_guest_access_token()
WHERE status = 'ACTIVA' 
  AND guest_access_token IS NULL;

-- Add comment
COMMENT ON COLUMN room_stays.guest_access_token IS 'Secure token for guest portal access. Auto-generated on check-in, cleared on check-out.';

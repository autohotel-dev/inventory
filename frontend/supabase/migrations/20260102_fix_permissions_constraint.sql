-- Migration: Make role column nullable and populate from role_id
-- Created: 2026-01-02
-- Description: Fixes the NOT NULL constraint on role column to allow dynamic roles

-- Step 1: Make role column nullable
ALTER TABLE role_permissions 
ALTER COLUMN role DROP NOT NULL;

-- Step 2: Update existing records to populate role from role_id
UPDATE role_permissions rp
SET role = r.name
FROM roles r
WHERE rp.role_id = r.id
AND rp.role IS NULL;

-- Step 3: Drop the old role check constraint (it limits to hardcoded roles)
ALTER TABLE role_permissions 
DROP CONSTRAINT IF EXISTS role_permissions_role_check;

-- Step 4: Update the API to populate both role and role_id for backward compatibility
-- (This will be handled in the application code)

-- Step 5: Add a trigger to auto-populate role from role_id on insert/update
CREATE OR REPLACE FUNCTION sync_role_from_role_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_id IS NOT NULL THEN
    SELECT name INTO NEW.role
    FROM roles
    WHERE id = NEW.role_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_role_trigger ON role_permissions;
CREATE TRIGGER sync_role_trigger
  BEFORE INSERT OR UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION sync_role_from_role_id();

-- Step 6: Verify the changes
DO $$
BEGIN
  -- Check that role is now nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'role_permissions'
    AND column_name = 'role'
    AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Column role is still NOT NULL';
  END IF;
  
  RAISE NOTICE 'Migration completed successfully';
END $$;

COMMENT ON COLUMN role_permissions.role IS 'Role name (auto-populated from role_id via trigger for backward compatibility)';
COMMENT ON COLUMN role_permissions.role_id IS 'Primary role identifier (UUID reference to roles table)';

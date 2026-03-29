-- Migration: Create dynamic roles system
-- Created: 2026-01-02
-- Description: Migrates from hardcoded roles to dynamic roles table

-- Step 1: Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_protected BOOLEAN DEFAULT false, -- Cannot be deleted (admin, manager)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles table
-- All authenticated users can read active roles
CREATE POLICY "Users can read active roles"
  ON roles
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only admins can manage roles
CREATE POLICY "Admins can manage roles"
  ON roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.auth_user_id = auth.uid()
      AND employees.role IN ('admin', 'manager')
      AND employees.is_active = true
    )
  );

-- Step 2: Seed initial roles
INSERT INTO roles (name, display_name, description, is_protected) VALUES
  ('admin', 'Administrador', 'Acceso completo al sistema', true),
  ('manager', 'Manager', 'Gerente del hotel', true),
  ('receptionist', 'Recepcionista', 'Personal de recepción', false),
  ('cochero', 'Cochero', 'Personal de valet parking', false)
ON CONFLICT (name) DO NOTHING;

-- Step 3: Add role_id to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);

-- Step 4: Migrate existing employee role data
UPDATE employees 
SET role_id = roles.id
FROM roles
WHERE roles.name = employees.role
AND employees.role_id IS NULL;

-- Step 5: Add role_id to role_permissions table
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);

-- Step 6: Migrate existing permission data
UPDATE role_permissions 
SET role_id = roles.id
FROM roles
WHERE roles.name = role_permissions.role
AND role_permissions.role_id IS NULL;

-- Step 7: Create function to update updated_at timestamp for roles
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS roles_updated_at ON roles;
CREATE TRIGGER roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_roles_updated_at();

-- Step 8: Add constraint to prevent deleting protected roles
CREATE OR REPLACE FUNCTION prevent_protected_role_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_protected = true THEN
    RAISE EXCEPTION 'Cannot delete protected role: %', OLD.name;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_protected_role_deletion_trigger ON roles;
CREATE TRIGGER prevent_protected_role_deletion_trigger
  BEFORE DELETE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_protected_role_deletion();

-- Step 9: Add constraint to prevent deleting roles in use
CREATE OR REPLACE FUNCTION prevent_role_deletion_if_in_use()
RETURNS TRIGGER AS $$
DECLARE
  employee_count INTEGER;
BEGIN
  -- Check if any employees have this role
  SELECT COUNT(*) INTO employee_count
  FROM employees
  WHERE role_id = OLD.id;
  
  IF employee_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete role "%" because % employee(s) are assigned to it', OLD.display_name, employee_count;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_role_deletion_if_in_use_trigger ON roles;
CREATE TRIGGER prevent_role_deletion_if_in_use_trigger
  BEFORE DELETE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_deletion_if_in_use();

-- Add comments
COMMENT ON TABLE roles IS 'Dynamic roles table for role-based access control';
COMMENT ON COLUMN roles.name IS 'Unique role identifier (lowercase, no spaces)';
COMMENT ON COLUMN roles.display_name IS 'Human-readable role name';
COMMENT ON COLUMN roles.is_protected IS 'Protected roles cannot be deleted (admin, manager)';
COMMENT ON COLUMN roles.is_active IS 'Inactive roles cannot be assigned to new employees';

-- Note: We keep the old 'role' column in employees and role_permissions for now
-- to ensure backward compatibility. It can be dropped later after verification.
-- To drop old columns (run after verification):
-- ALTER TABLE employees DROP COLUMN IF EXISTS role;
-- ALTER TABLE role_permissions DROP COLUMN IF EXISTS role;

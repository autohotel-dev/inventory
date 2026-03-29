-- ================================================================
-- MIGRATION: Add Valet Employee to Room Stays
-- Description: Add valet_employee_id field to room_stays table
-- Date: 2025-12-27
-- ================================================================

-- 1. Add valet_employee_id column to room_stays
ALTER TABLE room_stays 
ADD COLUMN IF NOT EXISTS valet_employee_id UUID REFERENCES employees(id);

-- 2. Add index for performance
CREATE INDEX IF NOT EXISTS idx_room_stays_valet ON room_stays(valet_employee_id);

-- 3. Update employees table to support cochero role (if constraint exists)
-- Note: This assumes you have a check constraint on the role column
-- If you don't have one, you can skip this or adjust accordingly

-- First, check if there's a constraint and drop it
DO $$ 
BEGIN
  -- Try to drop the constraint if it exists (adjust constraint name as needed)
  ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
  
  -- Add new constraint with cochero role
  ALTER TABLE employees ADD CONSTRAINT employees_role_check 
    CHECK (role IN ('admin', 'receptionist', 'manager', 'gerente', 'cochero'));
EXCEPTION
  WHEN OTHERS THEN
    -- If constraint doesn't exist or has different name, just add it
    ALTER TABLE employees ADD CONSTRAINT employees_role_check 
      CHECK (role IN ('admin', 'receptionist', 'manager', 'gerente', 'cochero'));
END $$;

-- 4. Add comment for documentation
COMMENT ON COLUMN room_stays.valet_employee_id IS 'Employee (cochero) assigned to this room stay - optional, can be assigned when they bring the order';

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- View column structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'room_stays' AND column_name = 'valet_employee_id';

-- View all cochero employees
-- SELECT id, first_name, last_name, email, role, is_active 
-- FROM employees 
-- WHERE role = 'cochero';

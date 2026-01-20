-- Add deleted_at column to employees table
ALTER TABLE employees
ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Optional: Create an index to speed up filtering of non-deleted employees
CREATE INDEX idx_employees_deleted_at ON employees(deleted_at) WHERE deleted_at IS NULL;

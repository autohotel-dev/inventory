-- ================================================================
-- MIGRATION: Add Shift Expenses System
-- Description: Create shift_expenses table for tracking cash disbursements
-- Date: 2025-12-27
-- ================================================================

-- 1. Create shift_expenses table
CREATE TABLE IF NOT EXISTS shift_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relaciones
  shift_session_id UUID NOT NULL REFERENCES shift_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  authorized_by UUID REFERENCES employees(id), -- Quién autorizó el gasto
  
  -- Detalles del gasto
  expense_type VARCHAR(50) NOT NULL CHECK (expense_type IN (
    'UBER', 'MAINTENANCE', 'REPAIR', 'SUPPLIES', 'PETTY_CASH', 'OTHER'
  )),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  recipient VARCHAR(255), -- A quién se le dio el dinero
  
  -- Comprobantes
  receipt_number VARCHAR(100),
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shift_expenses_session ON shift_expenses(shift_session_id);
CREATE INDEX IF NOT EXISTS idx_shift_expenses_employee ON shift_expenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_expenses_created_at ON shift_expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_expenses_type ON shift_expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_shift_expenses_status ON shift_expenses(status);

-- 3. Enable Row Level Security
ALTER TABLE shift_expenses ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for employees
CREATE POLICY "Users can view expenses from their own shifts"
ON shift_expenses FOR SELECT
USING (
  shift_session_id IN (
    SELECT id FROM shift_sessions 
    WHERE employee_id IN (
      SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create expenses in their active shifts"
ON shift_expenses FOR INSERT
WITH CHECK (
  shift_session_id IN (
    SELECT id FROM shift_sessions 
    WHERE employee_id IN (
      SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
    AND status = 'active'
  )
);

-- 5. RLS Policies for admins
CREATE POLICY "Admins can view all expenses"
ON shift_expenses FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'gerente')
  )
);

CREATE POLICY "Admins can update expense status"
ON shift_expenses FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'gerente')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'gerente')
  )
);

-- 6. Add columns to shift_closings for expense summary
ALTER TABLE shift_closings 
ADD COLUMN IF NOT EXISTS total_expenses DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS expenses_count INTEGER DEFAULT 0;

-- 7. Create trigger to prevent expense modification after shift is closed
CREATE OR REPLACE FUNCTION prevent_expense_modification_after_closing()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM shift_sessions 
    WHERE id = NEW.shift_session_id 
    AND status IN ('pending_closing', 'closed')
  ) THEN
    RAISE EXCEPTION 'No se pueden registrar gastos en un turno cerrado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_shift_status_before_expense
BEFORE INSERT ON shift_expenses
FOR EACH ROW
EXECUTE FUNCTION prevent_expense_modification_after_closing();

-- 8. Create function to calculate available cash
CREATE OR REPLACE FUNCTION calculate_available_cash(p_session_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  v_cash_in DECIMAL(10,2);
  v_expenses DECIMAL(10,2);
BEGIN
  -- Total cash from payments
  SELECT COALESCE(SUM(amount), 0)
  INTO v_cash_in
  FROM payments
  WHERE shift_session_id = p_session_id
  AND payment_method = 'cash';
  
  -- Total expenses
  SELECT COALESCE(SUM(amount), 0)
  INTO v_expenses
  FROM shift_expenses
  WHERE shift_session_id = p_session_id
  AND status != 'rejected';
  
  RETURN v_cash_in - v_expenses;
END;
$$ LANGUAGE plpgsql;

-- 9. Add comments for documentation
COMMENT ON TABLE shift_expenses IS 'Tracks cash disbursements during shifts (Uber, maintenance, repairs, etc.)';
COMMENT ON COLUMN shift_expenses.expense_type IS 'Type of expense: UBER, MAINTENANCE, REPAIR, SUPPLIES, PETTY_CASH, OTHER';
COMMENT ON COLUMN shift_expenses.status IS 'Approval status: pending, approved, rejected';
COMMENT ON FUNCTION calculate_available_cash IS 'Calculates available cash in shift (cash in - expenses)';

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- View table structure
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'shift_expenses';

-- View RLS policies
-- SELECT * FROM pg_policies WHERE tablename = 'shift_expenses';

-- Test function
-- SELECT calculate_available_cash('<session_id>');

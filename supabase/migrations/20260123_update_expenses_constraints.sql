-- Allow negative amounts for cash adjustments (to represent cash IN)
-- And add CASH_ADJUSTMENT to allowed types

ALTER TABLE shift_expenses DROP CONSTRAINT IF EXISTS shift_expenses_amount_check;
ALTER TABLE shift_expenses DROP CONSTRAINT IF EXISTS shift_expenses_expense_type_check;

ALTER TABLE shift_expenses 
  ADD CONSTRAINT shift_expenses_expense_type_check 
  CHECK (expense_type IN ('UBER', 'MAINTENANCE', 'REPAIR', 'SUPPLIES', 'PETTY_CASH', 'OTHER', 'CASH_ADJUSTMENT'));

-- No check for amount > 0 because we need negative values for cash injections

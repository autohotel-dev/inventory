-- ================================================================
-- MIGRATION: Link Transactions to Shift Sessions
-- Description: Add shift_session_id to key transaction tables for audit trail
-- Date: 2025-12-27
-- ================================================================

-- 1. Add shift_session_id to room_stays (Hospedajes)
ALTER TABLE room_stays 
ADD COLUMN IF NOT EXISTS shift_session_id UUID REFERENCES shift_sessions(id);

CREATE INDEX IF NOT EXISTS idx_room_stays_shift ON room_stays(shift_session_id);

-- 2. Add shift_session_id to sales_orders (Ventas/Comandas)
ALTER TABLE sales_orders 
ADD COLUMN IF NOT EXISTS shift_session_id UUID REFERENCES shift_sessions(id);

CREATE INDEX IF NOT EXISTS idx_sales_orders_shift ON sales_orders(shift_session_id);

-- 3. Add shift_session_id to payments (Pagos)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS shift_session_id UUID REFERENCES shift_sessions(id);

CREATE INDEX IF NOT EXISTS idx_payments_shift ON payments(shift_session_id);

-- 4. Helper function to get current active shift for a user
-- This helps in triggers or simple queries
CREATE OR REPLACE FUNCTION get_active_shift_id(p_user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id 
    FROM shift_sessions 
    WHERE employee_id = (SELECT id FROM employees WHERE auth_user_id = p_user_id)
    AND status = 'active'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- 5. Comment
COMMENT ON COLUMN room_stays.shift_session_id IS 'Shift session active when the stay started';
COMMENT ON COLUMN sales_orders.shift_session_id IS 'Shift session active when the order was created';
COMMENT ON COLUMN payments.shift_session_id IS 'Shift session active when the payment was processed';

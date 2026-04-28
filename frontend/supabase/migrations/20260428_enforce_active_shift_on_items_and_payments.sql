-- ==============================================================================
-- MIGRATION: Enforce Active Shift on sales_order_items and payments
-- Description:
--   Prevents consumptions/payments from being assigned to closed shifts.
--   If a new item or payment is inserted with a NULL or closed shift_session_id,
--   the trigger automatically reassigns it to the currently active reception shift.
--
-- Problem Solved:
--   When receptionist A registers a room entry and closes her shift, 
--   receptionist B's subsequent consumptions for that same room were being
--   assigned to A's closed shift — causing A to show surpluses and B to show deficits.
-- ==============================================================================

-- ─── 1. Trigger function for sales_order_items ──────────────────────────────

CREATE OR REPLACE FUNCTION enforce_active_shift_on_item()
RETURNS TRIGGER AS $$
DECLARE
  v_shift_status TEXT;
  v_active_shift_id UUID;
BEGIN
  -- 1. If a shift_session_id was provided, check if it's still active
  IF NEW.shift_session_id IS NOT NULL THEN
    SELECT status INTO v_shift_status
    FROM shift_sessions
    WHERE id = NEW.shift_session_id;
    
    -- If the shift is active/open, keep it — no changes needed
    IF v_shift_status IN ('active', 'open') THEN
      RETURN NEW;
    END IF;
    -- Otherwise, the shift is closed/pending_closing → fall through to reassignment
  END IF;
  
  -- 2. Shift is NULL or belongs to a closed session → find the active reception shift
  SELECT ss.id INTO v_active_shift_id
  FROM shift_sessions ss
  JOIN employees e ON ss.employee_id = e.id
  WHERE ss.status IN ('active', 'open')
    AND e.role IN ('receptionist', 'admin', 'manager')
  ORDER BY ss.clock_in_at DESC
  LIMIT 1;
  
  -- 3. Assign the active shift if found; otherwise leave as-is (safety fallback)
  IF v_active_shift_id IS NOT NULL THEN
    NEW.shift_session_id := v_active_shift_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on sales_order_items
DROP TRIGGER IF EXISTS trg_enforce_active_shift_on_item ON sales_order_items;
CREATE TRIGGER trg_enforce_active_shift_on_item
  BEFORE INSERT ON sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION enforce_active_shift_on_item();

COMMENT ON FUNCTION enforce_active_shift_on_item() IS 
  'Ensures new sales_order_items are always assigned to an active shift session. '
  'If the provided shift_session_id is NULL or points to a closed/pending_closing shift, '
  'it automatically reassigns the item to the currently active reception shift.';


-- ─── 2. Trigger function for payments ───────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_active_shift_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_shift_status TEXT;
  v_active_shift_id UUID;
BEGIN
  -- Skip enforcement for valet-collected payments (they use their own shift)
  -- Only enforce for PAGADO and PENDIENTE statuses (reception-side payments)
  IF NEW.status IN ('COBRADO_POR_VALET', 'CORROBORADO_RECEPCION') THEN
    RETURN NEW;
  END IF;

  -- 1. If a shift_session_id was provided, check if it's still active
  IF NEW.shift_session_id IS NOT NULL THEN
    SELECT status INTO v_shift_status
    FROM shift_sessions
    WHERE id = NEW.shift_session_id;
    
    -- If the shift is active/open, keep it
    IF v_shift_status IN ('active', 'open') THEN
      RETURN NEW;
    END IF;
    -- Otherwise fall through to reassignment
  END IF;
  
  -- 2. Find the active reception shift
  SELECT ss.id INTO v_active_shift_id
  FROM shift_sessions ss
  JOIN employees e ON ss.employee_id = e.id
  WHERE ss.status IN ('active', 'open')
    AND e.role IN ('receptionist', 'admin', 'manager')
  ORDER BY ss.clock_in_at DESC
  LIMIT 1;
  
  -- 3. Assign if found
  IF v_active_shift_id IS NOT NULL THEN
    NEW.shift_session_id := v_active_shift_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on payments
DROP TRIGGER IF EXISTS trg_enforce_active_shift_on_payment ON payments;
CREATE TRIGGER trg_enforce_active_shift_on_payment
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_active_shift_on_payment();

COMMENT ON FUNCTION enforce_active_shift_on_payment() IS 
  'Ensures new payments are always assigned to an active shift session. '
  'Skips valet-collected payments (COBRADO_POR_VALET, CORROBORADO_RECEPCION) '
  'as those legitimately use the valet shift. For all other payments, if the '
  'shift_session_id is NULL or closed, reassigns to the active reception shift.';

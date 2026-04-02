-- Function to handle atomic checkout process
-- This ensures all 3 operations (room update, order update, payments) succeed or fail together

CREATE OR REPLACE FUNCTION process_checkout_transaction(
  p_stay_id UUID,
  p_sales_order_id UUID,
  p_payment_data JSONB,
  p_checkout_valet_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_room_id UUID;
  v_stay_status TEXT;
  v_tolerance_started_at TIMESTAMPTZ;
  v_payment_record JSONB;
  v_main_payment_id UUID;
  v_shift_session_id UUID;
  v_employee_id UUID;
BEGIN
  -- 1. Validate and Lock Stay
  SELECT room_id, status, tolerance_started_at 
  INTO v_room_id, v_stay_status, v_tolerance_started_at
  FROM room_stays 
  WHERE id = p_stay_id
  FOR UPDATE; -- Prevent concurrent modifications

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estancia no encontrada');
  END IF;

  IF v_stay_status = 'FINALIZADA' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La estancia ya fue finalizada');
  END IF;

  -- 2. Update Room Stay
  UPDATE room_stays
  SET 
    status = 'FINALIZADA',
    actual_check_out_at = NOW(),
    checkout_valet_employee_id = p_checkout_valet_id
  WHERE id = p_stay_id;

  -- 3. Update Sales Order
  UPDATE sales_orders
  SET status = 'ENDED'
  WHERE id = p_sales_order_id;

  -- 4. Update Room Status (Logic from use-room-actions.ts)
  -- If tolerance is active, set to OCUPADA (waiting to become clean/occupied again)
  -- Otherwise set to SUCIA (needs cleaning)
  UPDATE rooms
  SET status = CASE 
    WHEN v_tolerance_started_at IS NOT NULL THEN 'OCUPADA'
    ELSE 'SUCIA'
  END
  WHERE id = v_room_id;

  -- 5. Process Payments from JSONB array
  -- Expected JSON format: [{ amount, method, reference, ... }, ...]
  
  -- We assume the frontend passes the correct JSON structure for payments.
  -- We process them in a loop.
  
  FOR v_payment_record IN SELECT * FROM jsonb_array_elements(p_payment_data)
  LOOP
    -- Insert payment
    INSERT INTO payments (
      sales_order_id,
      amount,
      payment_method,
      reference,
      concept,
      status,
      payment_type,
      shift_session_id,
      parent_payment_id,
      terminal_code,
      card_last_4,
      card_type
    ) VALUES (
      (v_payment_record->>'sales_order_id')::UUID,
      (v_payment_record->>'amount')::NUMERIC,
      v_payment_record->>'payment_method',
      v_payment_record->>'reference',
      v_payment_record->>'concept',
      v_payment_record->>'status',
      v_payment_record->>'payment_type',
        CASE WHEN (v_payment_record->>'shift_session_id') IS NULL THEN NULL
             ELSE (v_payment_record->>'shift_session_id')::UUID END,
        CASE WHEN (v_payment_record->>'parent_payment_id') IS NULL THEN NULL 
             ELSE (v_payment_record->>'parent_payment_id')::UUID END,
      v_payment_record->>'terminal_code',
      v_payment_record->>'card_last_4',
      v_payment_record->>'card_type'
    );
  END LOOP;

  -- Success
  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  -- Automatic rollback happens here due to transaction failure
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

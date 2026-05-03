CREATE OR REPLACE FUNCTION claim_checkout_valet(
  p_stay_id UUID,
  p_valet_id UUID,
  p_person_count INT
) RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE room_stays
  SET 
    checkout_valet_employee_id = p_valet_id,
    current_people = p_person_count,
    valet_checkout_requested_at = NOW()
  WHERE id = p_stay_id
    AND (checkout_valet_employee_id IS NULL OR checkout_valet_employee_id = p_valet_id)
  RETURNING TRUE INTO v_updated;

  RETURN COALESCE(v_updated, FALSE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION propose_checkout_valet(
  p_stay_id UUID,
  p_valet_id UUID,
  p_payments JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE room_stays
  SET 
    checkout_valet_employee_id = p_valet_id,
    checkout_payment_data = p_payments,
    valet_checkout_requested_at = NOW()
  WHERE id = p_stay_id
    AND (checkout_valet_employee_id IS NULL OR checkout_valet_employee_id = p_valet_id)
  RETURNING TRUE INTO v_updated;

  RETURN COALESCE(v_updated, FALSE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION claim_entry_valet(
  p_stay_id UUID,
  p_valet_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE room_stays
  SET valet_employee_id = p_valet_id
  WHERE id = p_stay_id
    AND (valet_employee_id IS NULL OR valet_employee_id = p_valet_id)
  RETURNING TRUE INTO v_updated;

  RETURN COALESCE(v_updated, FALSE);
END;
$$ LANGUAGE plpgsql;

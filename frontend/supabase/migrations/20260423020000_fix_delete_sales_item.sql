-- Migration to fix the issue where deleting an unpaid item leaves orphaned payments
-- and out-of-sync sales_orders totals.

CREATE OR REPLACE FUNCTION delete_unpaid_sales_item(
  p_item_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_sales_order_id UUID;
  v_concept_type TEXT;
  v_unit_price DECIMAL;
  v_qty INTEGER;
  v_total_amount DECIMAL;
  v_payment_concept TEXT;
  v_payment_id UUID;
  v_is_paid BOOLEAN;
BEGIN
  -- 1. Get the item details and lock the row
  SELECT sales_order_id, concept_type, unit_price, COALESCE(qty, 1), is_paid 
  INTO v_sales_order_id, v_concept_type, v_unit_price, v_qty, v_is_paid
  FROM sales_order_items 
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item no encontrado');
  END IF;

  IF v_is_paid THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se puede eliminar un ítem que ya está pagado');
  END IF;

  v_total_amount := v_unit_price * v_qty;

  -- 2. Delete the item
  DELETE FROM sales_order_items WHERE id = p_item_id;

  -- 3. Map concept_type to payment concept
  v_payment_concept := CASE 
    WHEN v_concept_type = 'EXTRA_PERSON' THEN 'PERSONA_EXTRA'
    WHEN v_concept_type = 'EXTRA_HOUR' THEN 'EXTRA_HOUR'
    WHEN v_concept_type = 'DAMAGE_CHARGE' THEN 'DAMAGE_CHARGE'
    WHEN v_concept_type = 'ROOM_BASE' THEN 'ESTANCIA'
    ELSE v_concept_type
  END;

  -- 4. Find and CANCEL exactly one corresponding PENDIENTE payment
  -- We use ctid to update exactly one row in case there are duplicates
  UPDATE payments 
  SET status = 'CANCELADO'
  WHERE id = (
    SELECT id FROM payments 
    WHERE sales_order_id = v_sales_order_id 
      AND concept = v_payment_concept 
      AND status = 'PENDIENTE' 
      AND amount = v_total_amount
    LIMIT 1
  )
  RETURNING id INTO v_payment_id;

  -- 5. Update the sales order totals
  UPDATE sales_orders
  SET 
    subtotal = GREATEST(0, subtotal - v_total_amount),
    total = GREATEST(0, total - v_total_amount),
    remaining_amount = GREATEST(0, remaining_amount - v_total_amount)
  WHERE id = v_sales_order_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Ítem eliminado y pago pendiente cancelado',
    'deleted_payment_id', v_payment_id,
    'total_amount_deducted', v_total_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

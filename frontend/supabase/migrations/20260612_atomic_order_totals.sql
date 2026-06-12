-- Atomic sales order total update to prevent race conditions
-- This function updates the totals in a single atomic operation

CREATE OR REPLACE FUNCTION update_sales_order_totals(
  p_sales_order_id UUID,
  p_additional_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Atomic update: increment totals in a single operation
  UPDATE sales_orders
  SET 
    subtotal = subtotal + p_additional_amount,
    total = subtotal + p_additional_amount + tax,
    remaining_amount = remaining_amount + p_additional_amount,
    updated_at = NOW()
  WHERE id = p_sales_order_id
  RETURNING jsonb_build_object(
    'success', true,
    'new_remaining', remaining_amount,
    'new_subtotal', subtotal,
    'new_total', total
  ) INTO v_result;
  
  IF v_result IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  RETURN v_result;
END;
$$;

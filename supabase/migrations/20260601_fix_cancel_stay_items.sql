-- Migration: Fix process_cancel_stay to properly mark items as cancelled
-- BUG: When cancelling a stay, items were not marked is_cancelled=true,
-- causing phantom amounts in income reports.
-- 
-- This also fixes 8 historical phantom records (already applied via direct UPDATE).

CREATE OR REPLACE FUNCTION public.process_cancel_stay(
  p_room_stay_id UUID,
  p_room_id UUID,
  p_sales_order_id UUID,
  p_reason TEXT,
  p_refund_type TEXT DEFAULT 'none',
  p_refund_amount NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valet_money_warning NUMERIC := 0;
  v_total_paid NUMERIC := 0;
  v_retained_amount NUMERIC := 0;
  v_old_notes TEXT;
  v_new_notes TEXT;
  v_order_update_note TEXT;
  v_refund_val NUMERIC := 0;
  v_refund_payment_id UUID;
BEGIN
  -- 1. Finalizar la estancia como CANCELADA y limpiar datos
  UPDATE room_stays
  SET status = 'CANCELADA',
      actual_check_out_at = NOW(),
      checkout_payment_data = NULL,
      vehicle_requested_at = NULL,
      valet_checkout_requested_at = NULL
  WHERE id = p_room_stay_id;

  -- 2. Marcar habitación como SUCIA
  UPDATE rooms
  SET status = 'SUCIA'
  WHERE id = p_room_id;

  -- 3. Calcular dinero retenido por el cochero
  SELECT COALESCE(SUM(amount), 0)
  INTO v_valet_money_warning
  FROM payments
  WHERE sales_order_id = p_sales_order_id
    AND status IN ('COBRADO_POR_VALET', 'CORROBORADO_RECEPCION');

  -- 4. Cancelar pagos no finalizados
  UPDATE payments
  SET status = 'CANCELADO',
      notes = 'Cancelado por cancelación de estancia: ' || p_reason
  WHERE sales_order_id = p_sales_order_id
    AND status IN ('PENDIENTE', 'COBRADO_POR_VALET', 'CORROBORADO_RECEPCION');

  -- 5. Cancelar sales_order_items no pagados
  -- FIXED: Now properly sets is_cancelled=true, cancelled_at, and cancellation_reason
  -- Previously only set delivery_status='CANCELLED' which left is_cancelled=false,
  -- causing phantom amounts in income reports.
  UPDATE sales_order_items
  SET delivery_status = 'CANCELLED',
      is_cancelled = true,
      cancelled_at = NOW(),
      cancellation_reason = 'Cancelación de estancia: ' || COALESCE(p_reason, ''),
      is_paid = false
  WHERE sales_order_id = p_sales_order_id
    AND is_paid = false;

  -- 6. Calcular monto retenido y actualizar orden
  SELECT paid_amount, notes
  INTO v_total_paid, v_old_notes
  FROM sales_orders
  WHERE id = p_sales_order_id;

  v_total_paid := COALESCE(v_total_paid, 0);

  IF p_refund_type = 'none' THEN
    v_retained_amount := v_total_paid;
  ELSIF p_refund_type = 'full' THEN
    v_retained_amount := 0;
    v_refund_val := v_total_paid;
  ELSIF p_refund_type = 'partial' THEN
    v_retained_amount := GREATEST(0, v_total_paid - COALESCE(p_refund_amount, 0));
    v_refund_val := COALESCE(p_refund_amount, 0);
  END IF;

  -- Register REFUND payment if refund value is greater than 0
  IF v_refund_val > 0 THEN
    INSERT INTO public.payments (
      sales_order_id,
      amount,
      payment_method,
      reference,
      concept,
      status,
      payment_type,
      notes,
      collected_by
    ) VALUES (
      p_sales_order_id,
      v_refund_val,
      'EFECTIVO',
      'REF-' || substr(md5(random()::text), 1, 8),
      'REFUND',
      'CANCELADO',
      'COMPLETO',
      'Reembolso por cancelación de estancia: ' || COALESCE(p_reason, ''),
      (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
    ) RETURNING id INTO v_refund_payment_id;
  END IF;

  v_order_update_note := '❌ CANCELADA: ' || COALESCE(p_reason, '') || '. Reembolso: ' ||
                         CASE WHEN p_refund_type = 'full' THEN 'Total'
                              WHEN p_refund_type = 'partial' THEN 'Parcial $' || COALESCE(p_refund_amount, 0)::TEXT
                              ELSE 'Sin reembolso' END || 
                         ' (Retenido: $' || v_retained_amount::TEXT || ')';

  v_new_notes := TRIM(REPLACE(COALESCE(v_old_notes, ''), v_order_update_note, ''));
  v_new_notes := TRIM(v_new_notes || E'\n' || v_order_update_note);

  UPDATE sales_orders
  SET status = 'CANCELLED',
      subtotal = v_retained_amount,
      total = v_retained_amount,
      paid_amount = v_retained_amount,
      remaining_amount = 0,
      notes = v_new_notes
  WHERE id = p_sales_order_id;

  -- 7. Devolver el resultado
  RETURN jsonb_build_object(
    'success', true,
    'valetMoneyWarning', v_valet_money_warning
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

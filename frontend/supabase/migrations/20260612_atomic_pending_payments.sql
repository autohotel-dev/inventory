-- ================================================================
-- Atomic pending payments update to prevent race conditions
-- ================================================================

CREATE OR REPLACE FUNCTION update_pending_payments_atomic(
    p_sales_order_id UUID,
    p_total_paid NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pending_payments RECORD;
    v_remaining NUMERIC := p_total_paid;
    v_updated_count INT := 0;
BEGIN
    -- Lock and fetch pending payments atomically
    FOR v_pending_payments IN
        SELECT id, amount, concept
        FROM payments
        WHERE sales_order_id = p_sales_order_id
          AND status = 'PENDIENTE'
          AND parent_payment_id IS NULL
        ORDER BY created_at ASC
        FOR UPDATE  -- This locks the rows
    LOOP
        IF v_remaining <= 0 THEN EXIT; END IF;

        -- Update payment status to PAGADO
        UPDATE payments
        SET status = 'PAGADO',
            payment_method = 'EFECTIVO',
            reference = 'PAG-' || EXTRACT(EPOCH FROM NOW())::TEXT
        WHERE id = v_pending_payments.id;

        v_remaining := v_remaining - v_pending_payments.amount;
        v_updated_count := v_updated_count + 1;
    END LOOP;

    -- Update sales order remaining amount
    IF v_remaining < p_total_paid THEN
        UPDATE sales_orders
        SET remaining_amount = GREATEST(0, remaining_amount - (p_total_paid - v_remaining)),
            paid_amount = paid_amount + (p_total_paid - v_remaining)
        WHERE id = p_sales_order_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'payments_updated', v_updated_count,
        'remaining', GREATEST(0, v_remaining)
    );
END;
$$;

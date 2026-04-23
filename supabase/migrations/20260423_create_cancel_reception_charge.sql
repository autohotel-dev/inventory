-- Migration to add cancel_reception_charge RPC for anti-error reception flow
-- Allows cancelling pending items (extra hours, promotions, renewals, extra people)

CREATE OR REPLACE FUNCTION public.cancel_reception_charge(
    p_payment_id uuid,
    p_employee_id uuid
) RETURNS jsonb AS $$
DECLARE
    v_payment record;
    v_stay record;
    v_room_type record;
    v_hours_to_deduct numeric := 0;
    v_items_deleted integer := 0;
    v_people_to_deduct integer := 0;
BEGIN
    -- 1. Get payment
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
    END IF;

    IF v_payment.status != 'PENDIENTE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sólo se pueden cancelar cargos pendientes');
    END IF;

    -- 2. Get active stay and room
    SELECT rs.*, r.room_types_id INTO v_stay 
    FROM public.room_stays rs
    JOIN public.rooms r ON r.id = rs.room_id
    WHERE rs.sales_order_id = v_payment.sales_order_id AND rs.status = 'ACTIVA'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No se encontró estancia activa para esta orden');
    END IF;

    SELECT * INTO v_room_type FROM public.room_types WHERE id = v_stay.room_types_id;

    -- 3. Determine adjustments based on concept
    IF v_payment.concept = 'PROMO_4H' THEN
        v_hours_to_deduct := 4;
    ELSIF v_payment.concept = 'EXTRA_HOUR' THEN
        IF v_room_type.extra_hour_price > 0 THEN
            v_hours_to_deduct := v_payment.amount / v_room_type.extra_hour_price;
        END IF;
    ELSIF v_payment.concept = 'PERSONA_EXTRA' THEN
        v_people_to_deduct := 1;
    ELSIF v_payment.concept = 'RENEWAL' THEN
        -- Standard renewal deducts whatever weekday_hours is configured, default 4
        v_hours_to_deduct := COALESCE(v_room_type.weekday_hours, 4);
    END IF;

    -- 4. Delete the corresponding sales order items
    -- Find items that match the concept and sum up to the payment amount
    WITH items_to_delete AS (
        SELECT id, (qty * unit_price) as total_price
        FROM public.sales_order_items
        WHERE sales_order_id = v_payment.sales_order_id
          AND concept_type = CASE WHEN v_payment.concept = 'PROMO_4H' THEN 'PROMO_4H'
                                  WHEN v_payment.concept = 'EXTRA_HOUR' THEN 'EXTRA_HOUR'
                                  WHEN v_payment.concept = 'PERSONA_EXTRA' THEN 'EXTRA_PERSON'
                                  WHEN v_payment.concept = 'RENEWAL' THEN 'RENEWAL'
                                  WHEN v_payment.concept = 'DAMAGE_CHARGE' THEN 'DAMAGE'
                                  ELSE v_payment.concept END
          AND (delivery_status = 'PENDING_VALET' OR delivery_status IS NULL OR delivery_status = 'PENDING')
          AND is_paid = false
        ORDER BY created_at DESC
    ),
    running_totals AS (
        SELECT id, total_price, sum(total_price) over (order by id desc) as running_total
        FROM items_to_delete
    ),
    final_items AS (
        SELECT id FROM running_totals WHERE running_total <= v_payment.amount
    )
    DELETE FROM public.sales_order_items WHERE id IN (SELECT id FROM final_items);

    GET DIAGNOSTICS v_items_deleted = ROW_COUNT;

    -- 5. Update room stay
    IF v_hours_to_deduct > 0 THEN
        UPDATE public.room_stays 
        SET expected_check_out_at = expected_check_out_at - (v_hours_to_deduct || ' hours')::interval
        WHERE id = v_stay.id;
    END IF;

    IF v_people_to_deduct > 0 THEN
        UPDATE public.room_stays
        SET current_people = GREATEST(1, current_people - v_people_to_deduct),
            total_people = GREATEST(1, total_people - v_people_to_deduct)
        WHERE id = v_stay.id;
    END IF;

    -- 6. Update sales orders
    UPDATE public.sales_orders
    SET subtotal = GREATEST(0, subtotal - v_payment.amount),
        total = GREATEST(0, total - v_payment.amount),
        remaining_amount = GREATEST(0, remaining_amount - v_payment.amount)
    WHERE id = v_payment.sales_order_id;

    -- 7. Delete the payment
    DELETE FROM public.payments WHERE id = p_payment_id;

    RETURN jsonb_build_object(
        'success', true, 
        'hours_deducted', v_hours_to_deduct, 
        'items_deleted', v_items_deleted,
        'stay_id', v_stay.id,
        'room_number', (SELECT number FROM public.rooms WHERE id = v_stay.room_id)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

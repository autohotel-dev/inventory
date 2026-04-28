-- Migration: cancel_item_with_refund RPC
-- Cancels any sales order item (pending or paid) with full audit trail
-- Handles refunds, time/people adjustments, and inventory returns

-- Step 1: Add cancellation columns to sales_order_items (if they don't exist)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sales_order_items' AND column_name = 'is_cancelled') THEN
        ALTER TABLE public.sales_order_items ADD COLUMN is_cancelled boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sales_order_items' AND column_name = 'cancellation_reason') THEN
        ALTER TABLE public.sales_order_items ADD COLUMN cancellation_reason text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sales_order_items' AND column_name = 'cancelled_at') THEN
        ALTER TABLE public.sales_order_items ADD COLUMN cancelled_at timestamptz;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'sales_order_items' AND column_name = 'cancelled_by') THEN
        ALTER TABLE public.sales_order_items ADD COLUMN cancelled_by uuid;
    END IF;
END $$;

-- Step 2: Create the main RPC
CREATE OR REPLACE FUNCTION public.cancel_item_with_refund(
    p_item_id uuid,
    p_employee_id uuid,
    p_reason text
) RETURNS jsonb AS $$
DECLARE
    v_item record;
    v_stay record;
    v_room_type record;
    v_order record;
    v_payment record;
    v_item_total numeric;
    v_hours_to_deduct numeric := 0;
    v_people_to_deduct integer := 0;
    v_was_paid boolean := false;
    v_refund_created boolean := false;
    v_payment_deleted boolean := false;
    v_inventory_returned boolean := false;
BEGIN
    -- Validate reason
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'El motivo de cancelación es obligatorio');
    END IF;

    -- 1. Get and lock the item
    SELECT * INTO v_item FROM public.sales_order_items WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item no encontrado');
    END IF;

    IF v_item.is_cancelled = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este item ya fue cancelado');
    END IF;

    v_item_total := v_item.qty * v_item.unit_price;
    v_was_paid := COALESCE(v_item.is_paid, false);

    -- 2. Get sales order
    SELECT * INTO v_order FROM public.sales_orders WHERE id = v_item.sales_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Orden de venta no encontrada');
    END IF;

    -- 3. Get active stay (may not exist for non-room sales)
    SELECT rs.*, r.room_type_id INTO v_stay 
    FROM public.room_stays rs
    JOIN public.rooms r ON r.id = rs.room_id
    WHERE rs.sales_order_id = v_item.sales_order_id AND rs.status = 'ACTIVA'
    FOR UPDATE;

    IF FOUND THEN
        SELECT * INTO v_room_type FROM public.room_types WHERE id = v_stay.room_type_id;
    END IF;

    -- 4. Determine time/people adjustments based on concept_type
    IF v_item.concept_type = 'PROMO_4H' THEN
        v_hours_to_deduct := 4;
    ELSIF v_item.concept_type = 'EXTRA_HOUR' THEN
        v_hours_to_deduct := v_item.qty;
    ELSIF v_item.concept_type = 'EXTRA_PERSON' THEN
        v_people_to_deduct := v_item.qty;
    ELSIF v_item.concept_type = 'RENEWAL' THEN
        v_hours_to_deduct := COALESCE(v_room_type.weekday_hours, 4);
    END IF;
    -- CONSUMPTION and other types don't adjust time/people

    -- 5. Apply stay adjustments (if stay exists)
    IF v_stay.id IS NOT NULL THEN
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
    END IF;

    -- 6. Handle payment side
    IF v_was_paid THEN
        -- Item was PAID → Create REFUND record for audit trail
        INSERT INTO public.payments (
            sales_order_id,
            amount,
            payment_method,
            reference,
            concept,
            status,
            payment_type,
            notes
        ) VALUES (
            v_item.sales_order_id,
            v_item_total,
            'REEMBOLSO',
            'REF-' || substr(md5(random()::text), 1, 8),
            'REFUND',
            'CANCELADO',
            'COMPLETO',
            'Cancelación: ' || p_reason || ' | Item: ' || COALESCE(v_item.concept_type, 'PRODUCT')
        );
        v_refund_created := true;

        -- Adjust order: reduce paid_amount, subtotal, and total
        UPDATE public.sales_orders
        SET subtotal = GREATEST(0, subtotal - v_item_total),
            total = GREATEST(0, total - v_item_total),
            paid_amount = GREATEST(0, paid_amount - v_item_total)
        WHERE id = v_item.sales_order_id;

    ELSE
        -- Item was PENDING → Find and remove/reduce the corresponding PENDIENTE payment
        -- Try exact concept match first (uses the same values as the frontend)
        SELECT * INTO v_payment 
        FROM public.payments 
        WHERE sales_order_id = v_item.sales_order_id 
          AND status = 'PENDIENTE' 
          AND concept = CASE 
              WHEN v_item.concept_type = 'EXTRA_PERSON' THEN 'PERSONA_EXTRA'
              WHEN v_item.concept_type = 'DAMAGE' THEN 'DAMAGE_CHARGE'
              WHEN v_item.concept_type = 'CONSUMPTION' THEN 'CONSUMPTION'
              WHEN v_item.concept_type = 'EXTRA_HOUR' THEN 'EXTRA_HOUR'
              WHEN v_item.concept_type = 'PROMO_4H' THEN 'PROMO_4H'
              WHEN v_item.concept_type = 'RENEWAL' THEN 'RENEWAL'
              ELSE COALESCE(v_item.concept_type, 'CONSUMPTION')
          END
        ORDER BY created_at DESC
        LIMIT 1 FOR UPDATE;

        IF FOUND THEN
            IF v_payment.amount <= v_item_total THEN
                DELETE FROM public.payments WHERE id = v_payment.id;
                v_payment_deleted := true;
            ELSE
                UPDATE public.payments SET amount = amount - v_item_total WHERE id = v_payment.id;
            END IF;
        END IF;

        -- Adjust order: reduce subtotal and total
        UPDATE public.sales_orders
        SET subtotal = GREATEST(0, subtotal - v_item_total),
            total = GREATEST(0, total - v_item_total)
        WHERE id = v_item.sales_order_id;
    END IF;

    -- remaining_amount is auto-recalculated by trigger trg_sync_sales_order_totals

    -- 7. Return inventory for physical products (CONSUMPTION items with product_id)
    IF v_item.product_id IS NOT NULL AND v_item.concept_type = 'CONSUMPTION' THEN
        INSERT INTO public.inventory_movements (
            product_id,
            warehouse_id,
            quantity,
            movement_type,
            reason_id,
            reason,
            notes,
            reference_table,
            reference_id,
            created_by
        ) VALUES (
            v_item.product_id,
            v_order.warehouse_id,
            v_item.qty,
            'IN',
            7,
            'CANCELLATION',
            'Devolución por cancelación: ' || p_reason,
            'sales_order_items',
            v_item.id,
            p_employee_id
        );
        v_inventory_returned := true;
    END IF;

    -- 8. Soft-delete: Mark item as cancelled + set delivery_status CANCELLED
    UPDATE public.sales_order_items
    SET is_cancelled = true,
        cancellation_reason = p_reason,
        cancelled_at = now(),
        cancelled_by = p_employee_id,
        delivery_status = 'CANCELLED'
    WHERE id = p_item_id;

    RETURN jsonb_build_object(
        'success', true, 
        'was_paid', v_was_paid,
        'refund_created', v_refund_created,
        'payment_deleted', v_payment_deleted,
        'inventory_returned', v_inventory_returned,
        'hours_deducted', v_hours_to_deduct,
        'people_deducted', v_people_to_deduct,
        'amount', v_item_total,
        'stay_id', v_stay.id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

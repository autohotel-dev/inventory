-- Función para sincronizar el estado de los items de venta con los pagos reales
-- Previene duplicación y mantiene consistencia entre items y pagos

CREATE OR REPLACE FUNCTION sync_payment_items(
    p_sales_order_id UUID,
    p_employee_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_total_paid DECIMAL := 0;
    v_items_updated INTEGER := 0;
    v_items_count INTEGER := 0;
    v_payment_count INTEGER := 0;
BEGIN
    -- 1. Calcular el total realmente pagado (solo PAGADO, no COBRADO_POR_VALET ni CORROBORADO_RECEPCION)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM payments
    WHERE sales_order_id = p_sales_order_id
      AND status = 'PAGADO';

    -- 2. Contar pagos válidos para logging (todos los pagos excepto PENDIENTE/CANCELADO)
    SELECT COUNT(*) INTO v_payment_count
    FROM payments
    WHERE sales_order_id = p_sales_order_id
      AND status NOT IN ('PENDIENTE', 'CANCELADO');

    -- 3. Actualizar items de venta en orden de prioridad (ROOM_BASE primero, luego extras)
    -- Usamos un cursor para procesar en orden correcto
    DECLARE item_cursor CURSOR FOR
        SELECT id, unit_price, concept_type
        FROM sales_order_items
        WHERE sales_order_id = p_sales_order_id
          AND is_paid = false
        ORDER BY 
            CASE concept_type 
                WHEN 'ROOM_BASE' THEN 1 
                WHEN 'EXTRA_PERSON' THEN 2 
                ELSE 3 
            END,
            created_at ASC;
    
    DECLARE 
        v_item_id UUID;
        v_item_price DECIMAL;
        v_item_concept TEXT;
        v_remaining_to_pay DECIMAL := v_total_paid;
    BEGIN
        OPEN item_cursor;
        LOOP
            FETCH item_cursor INTO v_item_id, v_item_price, v_item_concept;
            EXIT WHEN NOT FOUND;
            
            v_items_count := v_items_count + 1;
            
            -- Si todavía hay suficiente saldo para pagar este item
            IF v_remaining_to_pay >= v_item_price THEN
                UPDATE sales_order_items
                SET 
                    is_paid = true,
                    paid_at = NOW(),
                    payment_method = CASE 
                        WHEN v_payment_count = 1 THEN (
                            SELECT payment_method 
                            FROM payments 
                            WHERE sales_order_id = p_sales_order_id 
                              AND status NOT IN ('PENDIENTE', 'CANCELADO')
                            LIMIT 1
                        )
                        ELSE 'MIXTO'
                    END
                WHERE id = v_item_id;
                
                v_items_updated := v_items_updated + 1;
                v_remaining_to_pay := v_remaining_to_pay - v_item_price;
            END IF;
        END LOOP;
        CLOSE item_cursor;
    END;

    -- 4. Actualizar el estado de la orden si todo está pagado
    IF v_items_updated > 0 THEN
        UPDATE sales_orders
        SET 
            status = CASE 
                WHEN (SELECT COUNT(*) FROM sales_order_items 
                      WHERE sales_order_id = p_sales_order_id AND is_paid = false) = 0 
                THEN 'PAID' 
                ELSE 'PARTIAL_PAID' 
            END,
            remaining_amount = GREATEST(0, remaining_amount - v_total_paid)
        WHERE id = p_sales_order_id;
    END IF;

    -- 5. Registrar en audit_logs si se proporcionó employee_id
    IF p_employee_id IS NOT NULL THEN
        INSERT INTO audit_logs (action, table_name, record_id, description, metadata)
        VALUES (
            'UPDATE',
            'sales_order_items',
            p_sales_order_id,
            format('Sincronizados %s items con %s pagos (%s total)', 
                   v_items_updated, v_payment_count, v_total_paid),
            jsonb_build_object(
                'total_paid', v_total_paid,
                'items_updated', v_items_updated,
                'items_count', v_items_count,
                'payment_count', v_payment_count,
                'synced_at', NOW()
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'total_paid', v_total_paid,
        'items_updated', v_items_updated,
        'items_count', v_items_count,
        'payment_count', v_payment_count
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar automáticamente cuando se actualizan pagos
CREATE OR REPLACE FUNCTION trigger_sync_payment_items()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo sincronizar si el pago cambió a PAGADO (desde cualquier otro status)
    IF TG_OP = 'INSERT' AND NEW.status = 'PAGADO' THEN
        PERFORM sync_payment_items(NEW.sales_order_id, NEW.collected_by);
    ELSIF TG_OP = 'UPDATE' AND (
        (OLD.status != 'PAGADO' AND NEW.status = 'PAGADO') OR 
        OLD.amount != NEW.amount
    ) THEN
        PERFORM sync_payment_items(NEW.sales_order_id, NEW.collected_by);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para sincronización automática
DROP TRIGGER IF EXISTS trigger_sync_payments ON payments;
CREATE TRIGGER trigger_sync_payments
    AFTER INSERT OR UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_sync_payment_items();

-- Actualizar el constraint payments_status_check para incluir CORROBORADO_RECEPCION
ALTER TABLE payments DROP CONSTRAINT payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check 
  CHECK (status IN ('PENDIENTE', 'PAGADO', 'CANCELADO', 'COBRADO_POR_VALET', 'CORROBORADO_RECEPCION'));

COMMENT ON FUNCTION sync_payment_items(UUID, UUID) IS 'Sincroniza el estado de pago de los items de venta con los pagos reales. Previene duplicación y mantiene consistencia.';
COMMENT ON TRIGGER trigger_sync_payments ON payments IS 'Sincroniza automáticamente los items de venta cuando se insertan o actualizan pagos.';

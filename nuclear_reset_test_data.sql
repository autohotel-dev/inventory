-- REINICIO SISTEMA (Versión Final v5)
-- Ejecutar en SQL Editor de Supabase:

DROP FUNCTION IF EXISTS purgesystem(text);

CREATE OR REPLACE FUNCTION purgesystem(confirm text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
    IF confirm != 'REINICIAR' THEN
        RAISE EXCEPTION 'Código incorrecto';
    END IF;

    -- 1. Tablas hijas de guest/survey (dependen de room_stays)
    DELETE FROM guest_notifications WHERE true;
    DELETE FROM survey_responses WHERE true;
    DELETE FROM guest_subscriptions WHERE true;

    -- 2. Shift closings (dependen de shift_sessions y payments)
    DELETE FROM shift_closing_reviews WHERE true;
    DELETE FROM shift_closing_details WHERE true;
    DELETE FROM shift_closings WHERE true;
    DELETE FROM shift_expenses WHERE true;

    -- 3. Pagos (dependen de sales_orders y shift_sessions)
    DELETE FROM payments WHERE true;

    -- 4. Items de venta (dependen de sales_orders)
    DELETE FROM sales_order_items WHERE true;

    -- 5. Estancias (dependen de rooms, sales_orders, shift_sessions)
    DELETE FROM room_stays WHERE true;

    -- 6. Órdenes de venta
    DELETE FROM sales_orders WHERE true;

    -- 7. Movimientos de inventario ligados a ventas
    DELETE FROM inventory_movements WHERE reference_table = 'sales_orders' OR reference_table = 'sales_order_items';

    -- 8. Turnos
    DELETE FROM shift_sessions WHERE true;

    -- 9. Eventos de sensores
    DELETE FROM sensor_events WHERE true;

    -- 10. Notificaciones internas
    DELETE FROM notifications WHERE true;

    -- 11. Logs de auditoría
    DELETE FROM audit_logs WHERE true;

    -- 12. Restaurar habitaciones a estado LIBRE
    UPDATE rooms SET status = 'LIBRE', notes = NULL WHERE true;

    -- 13. Registrar la purga en audit_logs
    INSERT INTO audit_logs (action, description, metadata)
    VALUES ('PURGE_SYSTEM', 'Reinicio nuclear ejecutado desde panel de mantenimiento', 
            jsonb_build_object('executed_at', NOW()));

    RETURN 'OK';
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION purgesystem(text) TO authenticated;
GRANT EXECUTE ON FUNCTION purgesystem(text) TO service_role;

-- purgesystem() borra toda la operación (pagos, órdenes, estancias, turnos, auditoría).
-- Antes: EXECUTE para PUBLIC (incluido anon, sin sesión) y su única protección era la palabra
-- 'REINICIAR', visible en el bundle del POS. Ahora: solo usuarios con sesión pueden llamarla
-- y la función exige un empleado admin activo antes de borrar nada; registra quién la ejecutó.
-- Aplicado en producción el 2026-10-12 desde el SQL Editor.
CREATE OR REPLACE FUNCTION public.purgesystem(confirm text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public' SET row_security TO 'off'
AS $function$
DECLARE v_admin uuid;
BEGIN
    SELECT id INTO v_admin FROM employees
     WHERE auth_user_id = auth.uid() AND role = 'admin' AND is_active AND deleted_at IS NULL;
    IF v_admin IS NULL THEN
        RAISE EXCEPTION 'Solo un administrador puede reiniciar el sistema';
    END IF;
    IF confirm != 'REINICIAR' THEN
        RAISE EXCEPTION 'Código incorrecto';
    END IF;

    DELETE FROM handoff_note_comments WHERE true;
    DELETE FROM flow_events WHERE true;
    DELETE FROM shift_handoff_notes WHERE true;
    DELETE FROM operation_flows WHERE true;
    DELETE FROM stay_loaned_items WHERE true;
    DELETE FROM guest_notifications WHERE true;
    DELETE FROM survey_responses WHERE true;
    DELETE FROM guest_subscriptions WHERE true;
    DELETE FROM shift_closing_reviews WHERE true;
    DELETE FROM shift_closing_details WHERE true;
    DELETE FROM shift_closings WHERE true;
    DELETE FROM shift_expenses WHERE true;
    DELETE FROM payments WHERE true;
    DELETE FROM sales_order_items WHERE true;
    DELETE FROM room_stays WHERE true;
    DELETE FROM sales_orders WHERE true;
    DELETE FROM inventory_movements WHERE reference_table = 'sales_orders' OR reference_table = 'sales_order_items';
    DELETE FROM employee_movements WHERE true;
    DELETE FROM shift_sessions WHERE true;
    DELETE FROM sensor_events WHERE true;
    DELETE FROM notifications WHERE true;
    DELETE FROM audit_logs WHERE true;
    UPDATE rooms SET status = 'LIBRE', notes = NULL WHERE true;

    INSERT INTO audit_logs (event_type, entity_type, entity_id, action, description, metadata)
    VALUES ('SYSTEM', 'system', gen_random_uuid(), 'PURGE_SYSTEM',
            'Reinicio nuclear ejecutado desde panel de mantenimiento',
            jsonb_build_object('executed_at', NOW(), 'executed_by', v_admin));
    RETURN 'OK';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.purgesystem(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purgesystem(text) TO authenticated;

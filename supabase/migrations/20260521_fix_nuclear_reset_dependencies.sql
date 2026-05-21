-- Redefine purgesystem to clean up dependencies in correct order to avoid foreign key constraint violations
CREATE OR REPLACE FUNCTION public.purgesystem(confirm text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
BEGIN
    IF confirm != 'REINICIAR' THEN
        RAISE EXCEPTION 'Código incorrecto';
    END IF;

    -- 1. Third-level dependencies (referencing handoff notes, operation flows, etc.)
    DELETE FROM handoff_note_comments WHERE true;
    DELETE FROM flow_events WHERE true;

    -- 2. Second-level dependencies (referencing stays, orders, shift sessions)
    DELETE FROM shift_handoff_notes WHERE true;
    DELETE FROM operation_flows WHERE true;
    DELETE FROM stay_loaned_items WHERE true;
    DELETE FROM guest_notifications WHERE true;
    DELETE FROM survey_responses WHERE true;
    DELETE FROM guest_subscriptions WHERE true;
    DELETE FROM shift_closing_reviews WHERE true;
    DELETE FROM shift_closing_details WHERE true;

    -- 3. Core transaction tables (referencing shift_sessions, rooms, etc.)
    DELETE FROM shift_closings WHERE true;
    DELETE FROM shift_expenses WHERE true;
    DELETE FROM payments WHERE true;
    DELETE FROM sales_order_items WHERE true;
    DELETE FROM room_stays WHERE true;
    DELETE FROM sales_orders WHERE true;
    DELETE FROM inventory_movements WHERE reference_table = 'sales_orders' OR reference_table = 'sales_order_items';
    DELETE FROM employee_movements WHERE true;

    -- 4. Session and system logs
    DELETE FROM shift_sessions WHERE true;
    DELETE FROM sensor_events WHERE true;
    DELETE FROM notifications WHERE true;
    DELETE FROM audit_logs WHERE true;

    -- Reset all rooms status to LIBRE
    UPDATE rooms SET status = 'LIBRE', notes = NULL WHERE true;

    -- Create new audit log for system purge
    INSERT INTO audit_logs (event_type, entity_type, entity_id, action, description, metadata)
    VALUES ('SYSTEM', 'system', gen_random_uuid(), 'PURGE_SYSTEM', 
            'Reinicio nuclear ejecutado desde panel de mantenimiento', 
            jsonb_build_object('executed_at', NOW()));

    RETURN 'OK';
END;
$function$;

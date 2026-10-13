-- ════════════════════════════════════════════════════════════════════════════
-- Turnos de cochero/camarista que se quedan abiertos
--
-- La app solo cerraba el turno al "Cerrar sesión" si su estado local creía que había uno
-- activo; y si el cochero cierra la app o se le apaga el celular, nada lo cierra. Hubo un turno
-- abierto 4 meses (ocupando uno de los 4 lugares de max_shifts_valet) y el 8.5% de los turnos de
-- cochero duraron más de 16 h (mediana: 8 h).
--
--   close_my_open_shifts()      la app lo llama al cerrar sesión: cierra los turnos abiertos
--                               del empleado de la sesión (solo cochero/camarista; recepción
--                               nunca, porque su turno se cierra con el corte).
--   close_stale_valet_shifts()  cron cada 30 min: cierra turnos de cochero/camarista abiertos
--                               > 12 h y sin actividad en las últimas 4 h. La salida queda en su
--                               última actividad (no infla horas ni métricas). auto_closed = true.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- Última actividad registrada de un cochero desde que abrió turno
CREATE OR REPLACE FUNCTION public.last_valet_activity(p_employee_id uuid, p_since timestamptz)
 RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
    SELECT greatest(
        p_since,
        (SELECT max(greatest(i.delivery_accepted_at, i.delivery_completed_at)) FROM sales_order_items i
          WHERE i.delivery_accepted_by = p_employee_id AND i.delivery_accepted_at >= p_since),
        (SELECT max(i.delivery_picked_up_at) FROM sales_order_items i
          WHERE i.delivery_picked_up_by = p_employee_id AND i.delivery_picked_up_at >= p_since),
        (SELECT max(greatest(s.valet_claimed_at, s.valet_data_filled_at)) FROM room_stays s
          WHERE s.valet_employee_id = p_employee_id AND s.check_in_at >= p_since - interval '1 day'),
        (SELECT max(s.actual_check_out_at) FROM room_stays s
          WHERE s.checkout_valet_employee_id = p_employee_id AND s.actual_check_out_at >= p_since)
    );
$function$;

-- Al cerrar sesión en la app: cierra los turnos abiertos del empleado de la sesión
CREATE OR REPLACE FUNCTION public.close_my_open_shifts()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_emp employees%ROWTYPE;
    v_closed int;
BEGIN
    SELECT * INTO v_emp FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
    IF v_emp.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Empleado no identificado');
    END IF;
    IF v_emp.role NOT IN ('cochero', 'camarista') THEN
        -- Recepción/administración cierran su turno con el corte de caja
        RETURN jsonb_build_object('success', true, 'closed', 0, 'skipped_role', v_emp.role);
    END IF;

    UPDATE shift_sessions
       SET status = 'closed',
           clock_out_at = coalesce(clock_out_at, now()),
           notes = concat_ws(E'\n', notes, 'Cerrado al cerrar sesión en la app')
     WHERE employee_id = v_emp.id AND status IN ('active', 'open');
    GET DIAGNOSTICS v_closed = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'closed', v_closed);
END;
$function$;

-- Cron: turnos olvidados
CREATE OR REPLACE FUNCTION public.close_stale_valet_shifts(p_min_open_hours int DEFAULT 12, p_idle_hours int DEFAULT 4)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_shift record;
    v_last timestamptz;
    v_closed jsonb := '[]'::jsonb;
BEGIN
    FOR v_shift IN
        SELECT ss.id, ss.employee_id, ss.clock_in_at, e.first_name
          FROM shift_sessions ss JOIN employees e ON e.id = ss.employee_id
         WHERE ss.status IN ('active', 'open')
           AND e.role IN ('cochero', 'camarista')
           AND ss.clock_in_at < now() - make_interval(hours => p_min_open_hours)
    LOOP
        v_last := last_valet_activity(v_shift.employee_id, v_shift.clock_in_at);
        CONTINUE WHEN v_last > now() - make_interval(hours => p_idle_hours);

        UPDATE shift_sessions
           SET status = 'closed',
               clock_out_at = v_last,
               auto_closed = true,
               notes = concat_ws(E'\n', notes,
                   format('Cerrado automáticamente (%s): sin actividad desde %s; salida = última actividad registrada',
                          to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI'),
                          to_char(v_last AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI')))
         WHERE id = v_shift.id AND status IN ('active', 'open');

        v_closed := v_closed || jsonb_build_object('shift_id', v_shift.id, 'employee', v_shift.first_name, 'clock_out_at', v_last);
    END LOOP;

    RETURN jsonb_build_object('closed', jsonb_array_length(v_closed), 'shifts', v_closed, 'executed_at', now());
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.last_valet_activity(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_stale_valet_shifts(int, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_my_open_shifts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_my_open_shifts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_stale_valet_shifts(int, int) TO service_role;

-- Cada 30 minutos (pg_cron corre como postgres)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'close-stale-valet-shifts';
SELECT cron.schedule('close-stale-valet-shifts', '*/30 * * * *', $$SELECT public.close_stale_valet_shifts()$$);

COMMIT;

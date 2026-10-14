-- ════════════════════════════════════════════════════════════════════════════
-- Una sola estancia activa por habitación + cierre de la Hab. 125 (2026-10-14)
--
-- 1. process_quick_checkin (entrada rápida) no revisaba si la habitación ya tenía una
--    estancia activa (process_checkin_transaction sí). Así nacieron las estancias fantasma:
--    una segunda entrada sobre una habitación ocupada que se cerraba al liberarla, con venta y
--    sin pago (71 traslapes entre jun y sep). Se valida en la base, para cualquier pantalla:
--    - trigger: crear o mover una estancia ACTIVA a una habitación que ya tiene una → error
--      claro "La habitación X ya tiene una estancia activa".
--    - índice único parcial: garantiza lo mismo aunque dos entradas lleguen al mismo tiempo.
-- 2. Hab. 125, 30-ago 05:17 ($600): entrada sin vehículo, sin cochero, sin consumos, sin pago;
--    el control de TV nunca se encendió (se liberó solo a las 12:01) y la habitación se liberó
--    al vencer el tiempo. Ocurrió entre 8 entradas seguidas de la misma recepcionista
--    (04:59–05:46); las otras 7 tienen vehículo y pago. → registro por error: estancia
--    CANCELADA, renglón y pendiente cancelados. Efecto: ventas de habitación de agosto −$600.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. Una estancia activa por habitación ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_one_active_stay_per_room()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_room text;
BEGIN
    IF NEW.status IS DISTINCT FROM 'ACTIVA' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'ACTIVA' AND OLD.room_id IS NOT DISTINCT FROM NEW.room_id THEN
        RETURN NEW;
    END IF;
    IF EXISTS (SELECT 1 FROM room_stays
               WHERE room_id = NEW.room_id AND status = 'ACTIVA' AND id IS DISTINCT FROM NEW.id) THEN
        SELECT number INTO v_room FROM rooms WHERE id = NEW.room_id;
        RAISE EXCEPTION 'La habitación % ya tiene una estancia activa. Da salida a la estancia actual o elige otra habitación.', coalesce(v_room, '?')
              USING ERRCODE = 'unique_violation';
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_guard_one_active_stay_per_room ON public.room_stays;
CREATE TRIGGER tr_guard_one_active_stay_per_room
  BEFORE INSERT OR UPDATE OF status, room_id ON public.room_stays
  FOR EACH ROW EXECUTE FUNCTION public.guard_one_active_stay_per_room();

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_stays_one_active_per_room
  ON public.room_stays (room_id) WHERE status = 'ACTIVA';

-- ── 2. Hab. 125, 30-ago: registro por error ──────────────────────────────────
DO $$
DECLARE
    v_n integer;
    v_note text := 'Cierre administrativo 2026-10-14: ';
    v_order uuid := 'd8b3ee5e-2e93-4b7c-9ac2-c469040a3676';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM room_stays WHERE id = '95ff87e2-39bb-4ba6-8ec4-7b2b0384f437'
                   AND sales_order_id = v_order AND status = 'FINALIZADA' AND vehicle_plate IS NULL)
       OR EXISTS (SELECT 1 FROM payments WHERE sales_order_id = v_order AND status NOT IN ('PENDIENTE', 'CANCELADO')) THEN
        RAISE EXCEPTION 'La estancia de la Hab. 125 no está como se revisó';
    END IF;

    UPDATE sales_order_items
       SET is_cancelled = true, cancelled_at = now(),
           cancellation_reason = v_note || 'entrada registrada por error: sin vehículo, cochero, consumos ni pago; TV nunca encendida'
     WHERE sales_order_id = v_order AND NOT coalesce(is_cancelled, false);

    UPDATE payments
       SET status = 'CANCELADO', notes = concat_ws(' | ', notes, v_note || 'pendiente de entrada registrada por error')
     WHERE sales_order_id = v_order AND status = 'PENDIENTE' AND shift_session_id IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'Hab. 125: pendientes cancelados: %', v_n;

    UPDATE room_stays SET status = 'CANCELADA' WHERE id = '95ff87e2-39bb-4ba6-8ec4-7b2b0384f437';
END $$;

COMMIT;

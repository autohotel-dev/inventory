-- ════════════════════════════════════════════════════════════════════════════
-- Limpieza de cobros mal cerrados en estancias ya terminadas (junio–octubre 2026)
--
-- Ninguno de estos cambios mueve los montos de los reportes (ingresos, cierre de turno,
-- precorte): esos excluyen PENDIENTE y CANCELADO por igual y ya contaban COBRADO_POR_VALET.
-- Se verificó antes/después el total por mes de los pagos que entran a reportes.
--
-- 1. 45 pagos PENDIENTE huérfanos ($24,710) en estancias cerradas y saldadas: placeholders
--    que no se cancelaron al pagar (el cobro quedó en otro registro). → CANCELADO con nota.
-- 2. 17 pagos COBRADO_POR_VALET ($6,495) de estancias cerradas entre mayo y septiembre que
--    recepción nunca corroboró porque la salida se cerró sin pedirlo. Los reportes ya los
--    contaban como ingreso en el turno del cochero → PAGADO con nota (mismo turno). Se excluye
--    el de la Hab. 121 del 26-sep ($600): no tiene turno y el trigger lo movería al corte de hoy.
-- 3. Hab. 148 (21-jul): cobrado completo ($800) pero renglones sin marcar y un pendiente de
--    persona extra → renglones pagados y pendiente cancelado.
-- 4. 2 renglones ya pagados que seguían PENDING_VALET en estancias cerradas → COMPLETED.
--
-- NO se tocan: 5 estancias cerradas sin ningún pago (Hab. 134, 140, 128, 125, 120; $600 c/u)
-- ni el pago duplicado de $520 de la Hab. 02 (6-sep, en un corte ya cerrado): requieren
-- decisión de administración.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
    v_n integer;
    v_note text := 'Cierre administrativo 2026-10-14: ';
BEGIN
    -- 1. Pendientes huérfanos
    UPDATE payments p
       SET status = 'CANCELADO',
           notes = concat_ws(' | ', p.notes, v_note || 'pendiente huérfano en estancia cerrada y saldada')
      FROM room_stays s, sales_orders so
     WHERE s.sales_order_id = p.sales_order_id AND so.id = p.sales_order_id
       AND p.status = 'PENDIENTE'
       AND s.status IN ('FINALIZADA', 'CANCELADA')
       AND coalesce(so.remaining_amount, 0) = 0
       AND p.shift_session_id IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'Pendientes huérfanos cancelados: %', v_n;
    IF v_n > 45 THEN RAISE EXCEPTION 'Se esperaban como máximo 45 pendientes huérfanos, hay %', v_n; END IF;

    -- 2. Cobrados por cochero nunca corroborados, en estancias cerradas antes de octubre
    UPDATE payments p
       SET status = 'PAGADO',
           notes = concat_ws(' | ', p.notes, v_note || 'cobrado por cochero, la salida se cerró sin corroborar')
      FROM room_stays s
     WHERE s.sales_order_id = p.sales_order_id
       AND p.status = 'COBRADO_POR_VALET'
       AND s.status IN ('FINALIZADA', 'CANCELADA')
       AND coalesce(p.collected_at, p.created_at) < '2026-10-01'
       AND p.shift_session_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM shift_sessions ss WHERE ss.id = p.shift_session_id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'Cobros del cochero cerrados como pagados: %', v_n;
    IF v_n > 17 THEN RAISE EXCEPTION 'Se esperaban como máximo 17 cobros del cochero, hay %', v_n; END IF;

    -- 3. Hab. 148 (21-jul): pagada completa, marcas pendientes
    UPDATE sales_order_items i
       SET is_paid = true, paid_at = coalesce(i.paid_at, s.actual_check_out_at)
      FROM room_stays s, rooms r
     WHERE s.sales_order_id = i.sales_order_id AND r.id = s.room_id
       AND r.number = '148' AND s.check_in_at::date = '2026-07-21' AND s.status = 'FINALIZADA'
       AND NOT coalesce(i.is_paid, false) AND NOT coalesce(i.is_cancelled, false)
       AND (SELECT coalesce(sum(amount), 0) FROM payments x WHERE x.sales_order_id = s.sales_order_id AND x.status = 'PAGADO')
           >= (SELECT coalesce(sum(total), 0) FROM sales_order_items y WHERE y.sales_order_id = s.sales_order_id AND NOT coalesce(y.is_cancelled, false));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'Hab. 148: renglones marcados pagados: %', v_n;

    UPDATE payments p
       SET status = 'CANCELADO', notes = concat_ws(' | ', p.notes, v_note || 'persona extra ya cobrada en el pago de entrada')
      FROM room_stays s, rooms r
     WHERE s.sales_order_id = p.sales_order_id AND r.id = s.room_id
       AND r.number = '148' AND s.check_in_at::date = '2026-07-21' AND s.status = 'FINALIZADA'
       AND p.status = 'PENDIENTE' AND p.shift_session_id IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'Hab. 148: pendientes cancelados: %', v_n;

    -- 4. Renglones pagados que seguían esperando al cochero en estancias cerradas
    UPDATE sales_order_items i
       SET delivery_status = 'COMPLETED'
      FROM room_stays s
     WHERE s.sales_order_id = i.sales_order_id
       AND i.delivery_status = 'PENDING_VALET' AND i.is_paid
       AND s.status IN ('FINALIZADA', 'CANCELADA')
       AND i.concept_type <> 'ROOM_BASE';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'Renglones pagados pendientes del cochero → COMPLETED: %', v_n;
END $$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- Limpieza de cobros mal cerrados, parte 2 (2026-10-14). Ver docs del comunicado.
--
-- 1. Estancias fantasma: Hab. 134 (07-jun), 140 (11-jun), 128 (04-ago), 120 (21-sep).
--    Se crearon con la habitación ya ocupada por otra estancia que SÍ pagó (placas y pago
--    registrados) y se cerraron al liberar la habitación, sin placa, sin cochero y sin pago.
--    → estancia CANCELADA, renglón de habitación cancelado (con motivo) y pendiente cancelado.
--    Efecto en reportes: ventas de habitación jun −$1,200, ago −$600, sep −$600 (eran ventas
--    sin cobro que no existieron). Los pagos no cambian.
-- 2. Pago duplicado Hab. 02 (06-sep 17:32:46, $520 efectivo): mismo renglón (renovación $520)
--    registrado dos veces con 20 s de diferencia; la cuenta quedó pagada $520 de más
--    ($11,960 contra $11,440). → el segundo pago CANCELADO. Efecto: pagos de sep −$520 y el
--    turno cec01613 −$520.
-- 3. Hab. 121 (26-sep 03:35, $600 cobrados por el cochero Alfredo): sin turno asignado.
--    → se asigna al turno del cochero de esa noche (7cda14d2, el primero de los dos que tenía
--    abiertos a la vez) y queda PAGADO. Efecto: ese turno +$600; el total del mes no cambia
--    (el reporte por fechas ya lo contaba).
--
-- NO se toca: Hab. 125 (30-ago, $600): estancia de 8 h sin placa, sin pago y sin otra
-- estancia encima. Queda como adeudo para que administración decida.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
    v_n integer;
    v_note text := 'Cierre administrativo 2026-10-14: ';
    v_stays uuid[] := ARRAY['ba2d80ae-a81a-4ab0-bc08-2fe873c98732', '2ac87866-1729-43b8-a0f5-3cc2533c8ca9',
                            'dcca5884-0b42-4d79-86a7-039808438cf8', '1fc289d8-2bd9-4472-8061-b1f787d1b22a']::uuid[];
    v_orders uuid[];
BEGIN
    -- 1. Estancias fantasma (solo si siguen como se revisaron: cerradas y sin ningún pago real)
    SELECT array_agg(s.sales_order_id) INTO v_orders
      FROM room_stays s
     WHERE s.id = ANY(v_stays) AND s.status = 'FINALIZADA'
       AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.sales_order_id = s.sales_order_id
                       AND p.status NOT IN ('PENDIENTE', 'CANCELADO'));
    IF coalesce(array_length(v_orders, 1), 0) <> 4 THEN
        RAISE EXCEPTION 'Se esperaban 4 estancias fantasma sin pago, hay %', coalesce(array_length(v_orders, 1), 0);
    END IF;

    UPDATE sales_order_items
       SET is_cancelled = true, cancelled_at = now(),
           cancellation_reason = v_note || 'estancia duplicada: la habitación estaba ocupada por otra estancia que sí pagó'
     WHERE sales_order_id = ANY(v_orders) AND NOT coalesce(is_cancelled, false);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'Renglones de estancias fantasma cancelados: %', v_n;

    UPDATE payments
       SET status = 'CANCELADO', notes = concat_ws(' | ', notes, v_note || 'pendiente de estancia duplicada')
     WHERE sales_order_id = ANY(v_orders) AND status = 'PENDIENTE' AND shift_session_id IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'Pendientes de estancias fantasma cancelados: %', v_n;

    UPDATE room_stays SET status = 'CANCELADA' WHERE id = ANY(v_stays) AND status = 'FINALIZADA';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'Estancias fantasma → CANCELADA: %', v_n;

    -- 2. Pago duplicado Hab. 02
    UPDATE payments
       SET status = 'CANCELADO',
           notes = concat_ws(' | ', notes, v_note || 'pago duplicado de la renovación $520 (mismo renglón, 20 s después de 6e307596); la cuenta quedó $520 sobrepagada')
     WHERE id = 'd31aabea-8ede-4188-9420-08a1f0e75b5d' AND status = 'PAGADO' AND amount = 520;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION 'El pago duplicado de $520 no está como se revisó'; END IF;
    RAISE NOTICE 'Pago duplicado de $520 cancelado';

    -- 3. Hab. 121: primero el turno (mientras sigue COBRADO_POR_VALET el trigger de turno lo
    --    respeta; con otro estado lo movería al turno activo de hoy), después PAGADO.
    UPDATE payments SET shift_session_id = '7cda14d2-f426-497e-bd68-e22028865b6c'
     WHERE id = '4ad28ce9-ccdb-4985-bdc3-a6a7b4ef2206' AND status = 'COBRADO_POR_VALET' AND shift_session_id IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION 'El cobro de la Hab. 121 no está como se revisó'; END IF;
    UPDATE payments
       SET status = 'PAGADO',
           notes = concat_ws(' | ', notes, v_note || 'cobrado por cochero sin turno; asignado a su turno de esa noche y cerrado (la salida se cerró sin corroborar)')
     WHERE id = '4ad28ce9-ccdb-4985-bdc3-a6a7b4ef2206';
    IF (SELECT shift_session_id FROM payments WHERE id = '4ad28ce9-ccdb-4985-bdc3-a6a7b4ef2206') <> '7cda14d2-f426-497e-bd68-e22028865b6c' THEN
        RAISE EXCEPTION 'El trigger movió el cobro de la Hab. 121 de turno';
    END IF;
    RAISE NOTICE 'Hab. 121 asignada a su turno y cerrada';
END $$;

COMMIT;

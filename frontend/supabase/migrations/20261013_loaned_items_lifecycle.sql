-- ════════════════════════════════════════════════════════════════════════════
-- Artículos en préstamo: cerrar el ciclo
--
-- Antes: el trigger creaba préstamos al vender un consumo, pero nada los cerraba:
-- 741 de 759 seguían "PRESTADO" en estancias ya terminadas, los consumos cancelados
-- dejaban su préstamo vivo, nunca se registró un faltante y no se guardaba quién revisó.
--
-- Reglas de operación (decididas 2026-10-12):
--   * El checkout solo ADVIERTE si hay préstamos sin revisar; lo pendiente lo resuelve recepción.
--   * Un FALTANTE no genera cargo automático: se avisa a recepción y ella decide
--     COBRAR (monto editable, sugerido = precio de daño × cantidad) o PERDONAR (con motivo).
--
-- Todo es aditivo y compatible con las apps actuales (siguen pudiendo leer y actualizar
-- `status`); el endurecimiento de permisos de la tabla va en otra migración, cuando las apps
-- ya usen las funciones nuevas.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. Estados y columnas nuevas ─────────────────────────────────────────────
ALTER TABLE public.stay_loaned_items DROP CONSTRAINT IF EXISTS stay_loaned_items_status_check;
ALTER TABLE public.stay_loaned_items ADD CONSTRAINT stay_loaned_items_status_check
  CHECK (status IN ('PRESTADO', 'RECUPERADO', 'PERDIDO', 'ANULADO', 'CERRADO_SIN_REVISION'));

ALTER TABLE public.stay_loaned_items
  ADD COLUMN IF NOT EXISTS source_item_id  uuid REFERENCES public.sales_order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checked_by      uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checked_at      timestamptz,
  ADD COLUMN IF NOT EXISTS damage_decision text CHECK (damage_decision IN ('COBRADO', 'PERDONADO')),
  ADD COLUMN IF NOT EXISTS damage_amount   numeric(10,2),
  ADD COLUMN IF NOT EXISTS damage_item_id  uuid REFERENCES public.sales_order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_by      uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_at      timestamptz;

COMMENT ON COLUMN public.stay_loaned_items.status IS
  'PRESTADO: entregado, sin revisar | RECUPERADO | PERDIDO: faltante reportado (ver damage_decision) | ANULADO: el consumo se canceló | CERRADO_SIN_REVISION: histórico, la estancia cerró sin revisarse';
COMMENT ON COLUMN public.stay_loaned_items.damage_decision IS
  'Solo para PERDIDO. NULL = recepción aún no decide; COBRADO (damage_item_id = cargo) o PERDONADO (motivo en notes)';

CREATE INDEX IF NOT EXISTS idx_stay_loaned_items_stay   ON public.stay_loaned_items (room_stay_id);
CREATE INDEX IF NOT EXISTS idx_stay_loaned_items_item   ON public.stay_loaned_items (source_item_id);
CREATE INDEX IF NOT EXISTS idx_stay_loaned_items_open   ON public.stay_loaned_items (status, created_at)
  WHERE status = 'PRESTADO' OR (status = 'PERDIDO' AND damage_decision IS NULL);

DROP TRIGGER IF EXISTS tr_stay_loaned_items_updated_at ON public.stay_loaned_items;
CREATE TRIGGER tr_stay_loaned_items_updated_at
  BEFORE UPDATE ON public.stay_loaned_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 2. Vínculos producto → artículo: sin duplicados ──────────────────────────
-- Único duplicado: VINO LA REDONDA 750ML con 1 y con 2 del mismo artículo, creados con 19 s
-- de diferencia (una corrección). Se conserva el más reciente.
DELETE FROM public.product_loan_links a
USING public.product_loan_links b
WHERE a.product_id = b.product_id AND a.loan_item_id = b.loan_item_id
  AND (a.created_at, a.id) < (b.created_at, b.id);

ALTER TABLE public.product_loan_links
  DROP CONSTRAINT IF EXISTS product_loan_links_product_item_key;
ALTER TABLE public.product_loan_links
  ADD CONSTRAINT product_loan_links_product_item_key UNIQUE (product_id, loan_item_id);

-- ── 3. Crear préstamos: solo consumos, ligados al renglón que los origina ────
CREATE OR REPLACE FUNCTION public.auto_assign_loaned_items()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_room_stay_id uuid;
BEGIN
    IF NEW.concept_type IS DISTINCT FROM 'CONSUMPTION'
       OR NEW.product_id IS NULL
       OR COALESCE(NEW.is_cancelled, false) THEN
        RETURN NEW;
    END IF;

    SELECT id INTO v_room_stay_id
    FROM room_stays
    WHERE sales_order_id = NEW.sales_order_id
    ORDER BY (status = 'ACTIVA') DESC, check_in_at DESC
    LIMIT 1;

    IF v_room_stay_id IS NOT NULL THEN
        INSERT INTO stay_loaned_items
            (room_stay_id, loan_item_id, quantity, status, source_order_id, source_item_id, assigned_by)
        SELECT v_room_stay_id, pll.loan_item_id, ceil(pll.quantity * NEW.qty)::int, 'PRESTADO',
               NEW.sales_order_id, NEW.id, NEW.delivery_accepted_by
        FROM product_loan_links pll
        WHERE pll.product_id = NEW.product_id;
    END IF;

    RETURN NEW;
END;
$function$;

-- ── 4. Seguir al consumo: cancelado/borrado → ANULADO; quien acepta la entrega es el responsable
CREATE OR REPLACE FUNCTION public.sync_loaned_items_with_item()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE stay_loaned_items
           SET status = 'ANULADO', notes = concat_ws(' | ', notes, 'Consumo eliminado')
         WHERE source_item_id = OLD.id AND status = 'PRESTADO';
        RETURN OLD;
    END IF;

    IF COALESCE(NEW.is_cancelled, false) AND NOT COALESCE(OLD.is_cancelled, false) THEN
        UPDATE stay_loaned_items
           SET status = 'ANULADO', notes = concat_ws(' | ', notes, 'Consumo cancelado')
         WHERE source_item_id = NEW.id AND status = 'PRESTADO';
    END IF;

    IF NEW.delivery_accepted_by IS NOT NULL
       AND NEW.delivery_accepted_by IS DISTINCT FROM OLD.delivery_accepted_by THEN
        UPDATE stay_loaned_items
           SET assigned_by = NEW.delivery_accepted_by
         WHERE source_item_id = NEW.id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Nunca bloquear una venta, cancelación o entrega por el control de préstamos
    RAISE WARNING 'sync_loaned_items_with_item: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS tr_sync_loaned_items ON public.sales_order_items;
CREATE TRIGGER tr_sync_loaned_items
  AFTER UPDATE OF is_cancelled, delivery_accepted_by ON public.sales_order_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_loaned_items_with_item();

DROP TRIGGER IF EXISTS tr_sync_loaned_items_delete ON public.sales_order_items;
CREATE TRIGGER tr_sync_loaned_items_delete
  BEFORE DELETE ON public.sales_order_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_loaned_items_with_item();

-- ── 5. Revisar un préstamo (cochero o recepción): RECUPERADO / PERDIDO ────────
CREATE OR REPLACE FUNCTION public.resolve_loaned_item(p_loan_id uuid, p_status text, p_note text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_emp   employees%ROWTYPE;
    v_loan  stay_loaned_items%ROWTYPE;
    v_item  loan_item_catalog%ROWTYPE;
    v_room  text;
BEGIN
    SELECT * INTO v_emp FROM employees
     WHERE auth_user_id = auth.uid() AND is_active AND deleted_at IS NULL
     LIMIT 1;
    IF v_emp.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Empleado no identificado');
    END IF;

    IF p_status NOT IN ('RECUPERADO', 'PERDIDO') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Estado inválido');
    END IF;

    SELECT * INTO v_loan FROM stay_loaned_items WHERE id = p_loan_id FOR UPDATE;
    IF v_loan.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Préstamo no encontrado');
    END IF;
    IF v_loan.status NOT IN ('PRESTADO', 'RECUPERADO', 'PERDIDO') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este préstamo ya no se puede modificar (' || v_loan.status || ')');
    END IF;
    IF v_loan.damage_decision IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Recepción ya decidió sobre este faltante');
    END IF;
    IF v_loan.status = p_status THEN
        RETURN jsonb_build_object('success', true, 'status', p_status, 'unchanged', true);
    END IF;

    UPDATE stay_loaned_items SET
        status       = p_status,
        checked_by   = v_emp.id,
        checked_at   = now(),
        recovered_by = CASE WHEN p_status = 'RECUPERADO' THEN v_emp.id END,
        notes        = CASE WHEN nullif(trim(p_note), '') IS NULL THEN notes
                            ELSE concat_ws(' | ', notes, trim(p_note)) END
    WHERE id = p_loan_id;

    IF p_status = 'PERDIDO' THEN
        SELECT * INTO v_item FROM loan_item_catalog WHERE id = v_loan.loan_item_id;
        SELECT r.number INTO v_room FROM room_stays s JOIN rooms r ON r.id = s.room_id WHERE s.id = v_loan.room_stay_id;

        INSERT INTO notifications (user_id, type, title, message, data, is_read)
        SELECT DISTINCT e.auth_user_id, 'system_alert', '⚠️ Artículo faltante',
               format('Hab. %s: falta %s x%s (reportó %s). Decide si se cobra o se perdona.',
                      coalesce(v_room, '?'), coalesce(v_item.name, 'artículo'), v_loan.quantity, v_emp.first_name),
               jsonb_build_object('type', 'LOAN_MISSING', 'loanId', v_loan.id, 'stayId', v_loan.room_stay_id),
               false
        FROM shift_sessions ss
        JOIN employees e ON e.id = ss.employee_id
        WHERE ss.status IN ('active', 'open')
          AND e.role IN ('receptionist', 'admin', 'manager', 'supervisor', 'gerente')
          AND e.auth_user_id IS NOT NULL;
    END IF;

    RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$function$;

-- ── 6. Recepción decide sobre un faltante: COBRADO / PERDONADO ───────────────
CREATE OR REPLACE FUNCTION public.decide_loan_damage(
    p_loan_id uuid, p_decision text, p_amount numeric DEFAULT NULL, p_note text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_emp    employees%ROWTYPE;
    v_loan   stay_loaned_items%ROWTYPE;
    v_item   loan_item_catalog%ROWTYPE;
    v_amount numeric;
    v_shift  uuid;
    v_charge jsonb;
BEGIN
    SELECT * INTO v_emp FROM employees
     WHERE auth_user_id = auth.uid() AND is_active AND deleted_at IS NULL
       AND role IN ('receptionist', 'admin', 'manager', 'supervisor', 'gerente')
     LIMIT 1;
    IF v_emp.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo recepción o administración puede decidir sobre un faltante');
    END IF;

    IF p_decision NOT IN ('COBRADO', 'PERDONADO') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Decisión inválida');
    END IF;

    SELECT * INTO v_loan FROM stay_loaned_items WHERE id = p_loan_id FOR UPDATE;
    IF v_loan.id IS NULL OR v_loan.status <> 'PERDIDO' THEN
        RETURN jsonb_build_object('success', false, 'error', 'El préstamo no está reportado como faltante');
    END IF;
    IF v_loan.damage_decision IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ya se decidió: ' || v_loan.damage_decision);
    END IF;

    SELECT * INTO v_item FROM loan_item_catalog WHERE id = v_loan.loan_item_id;

    IF p_decision = 'PERDONADO' THEN
        IF nullif(trim(p_note), '') IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Indica el motivo para perdonar el faltante');
        END IF;
        UPDATE stay_loaned_items SET
            damage_decision = 'PERDONADO', damage_amount = 0,
            decided_by = v_emp.id, decided_at = now(),
            notes = concat_ws(' | ', notes, 'Perdonado: ' || trim(p_note))
        WHERE id = p_loan_id;
        RETURN jsonb_build_object('success', true, 'decision', 'PERDONADO');
    END IF;

    -- COBRADO: mismo camino que un cargo por daño de recepción (cargo + pago pendiente + totales)
    v_amount := round(coalesce(p_amount, coalesce(v_item.damage_price, 0) * v_loan.quantity), 2);
    IF v_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El monto a cobrar debe ser mayor a 0');
    END IF;

    SELECT id INTO v_shift FROM shift_sessions
     WHERE employee_id = v_emp.id AND status IN ('active', 'open')
     ORDER BY clock_in_at DESC LIMIT 1;

    v_charge := process_extra_charge(
        p_stay_id           => v_loan.room_stay_id,
        p_charge_type       => 'DAMAGE_CHARGE',
        p_amount            => v_amount,
        p_quantity          => 1,
        p_hours_to_extend   => 0,
        p_description       => format('Faltante: %s x%s', coalesce(v_item.name, 'artículo'), v_loan.quantity),
        p_shift_session_id  => v_shift,
        p_payment_reference => 'DMG-' || upper(substr(md5(random()::text), 1, 8))
    );
    IF NOT coalesce((v_charge->>'success')::boolean, false) THEN
        -- p.ej. la estancia ya cerró: no hay cuenta abierta donde cargar
        RETURN jsonb_build_object('success', false, 'error', coalesce(v_charge->>'error', 'No se pudo generar el cargo'));
    END IF;

    UPDATE stay_loaned_items SET
        damage_decision = 'COBRADO', damage_amount = v_amount,
        damage_item_id = (v_charge->>'item_id')::uuid,
        decided_by = v_emp.id, decided_at = now(),
        notes = CASE WHEN nullif(trim(p_note), '') IS NULL THEN notes
                     ELSE concat_ws(' | ', notes, trim(p_note)) END
    WHERE id = p_loan_id;

    RETURN jsonb_build_object('success', true, 'decision', 'COBRADO', 'amount', v_amount, 'item_id', v_charge->>'item_id');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_loaned_item(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decide_loan_damage(uuid, text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_loaned_items_with_item() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_loaned_item(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decide_loan_damage(uuid, text, numeric, text) TO authenticated, service_role;

-- ── 7. Histórico: préstamos de estancias ya cerradas que nunca se revisaron ──
-- No se marcan como recuperados (sería falsear) ni como faltantes (sería cobrar a ciegas).
-- Solo una vez: a partir de aquí, un préstamo sin revisar de una estancia cerrada es un pendiente
-- legítimo de recepción y una re-ejecución de esta migración no debe borrarlo.
UPDATE public.stay_loaned_items l
   SET status = 'CERRADO_SIN_REVISION',
       notes  = concat_ws(' | ', l.notes, 'Cerrado sin revisión al implementar el control (2026-10-13)')
  FROM public.room_stays s
 WHERE s.id = l.room_stay_id
   AND s.status <> 'ACTIVA'
   AND l.status = 'PRESTADO'
   AND NOT EXISTS (SELECT 1 FROM public.stay_loaned_items WHERE status = 'CERRADO_SIN_REVISION');

-- ── 8. Lectura sin sesión: nadie la usa (anon no tiene permisos de tabla); se quitan las políticas
DROP POLICY IF EXISTS "Allow read access to all on stay_loaned_items" ON public.stay_loaned_items;
DROP POLICY IF EXISTS "Allow read access to all on loan_item_catalog" ON public.loan_item_catalog;
DROP POLICY IF EXISTS "Allow read access to all on product_loan_links" ON public.product_loan_links;

COMMIT;

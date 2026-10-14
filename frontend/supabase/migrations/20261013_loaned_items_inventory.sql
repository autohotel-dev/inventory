-- ════════════════════════════════════════════════════════════════════════════
-- Artículos en préstamo: inventario y tiempo real
--
-- * stay_loaned_items entra a Realtime: Pendientes se actualiza cuando un cochero
--   marca recuperado / faltante.
-- * Existencias por artículo (cuántos vasos, hieleras… tiene el hotel). Se arranca
--   con un CONTEO físico; después solo cambian por movimientos registrados:
--     ENTRADA (compra) | BAJA (rotura, merma; motivo obligatorio) | CONTEO (ajuste a lo contado)
--     FALTANTE / FALTANTE_REVERTIDO: automáticos cuando un préstamo pasa a PERDIDO o deja de estarlo.
--   Mientras un artículo no tenga conteo (stock_total NULL) no se registra nada: no hay
--   existencia que ajustar.
-- * is_active: un artículo con historial no se puede borrar; desactivarlo hace que ya no
--   se preste aunque siga vinculado.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. Realtime ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stay_loaned_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stay_loaned_items;
  END IF;
END $$;

-- ── 2. Catálogo: existencia, mínimo disponible, activo ───────────────────────
ALTER TABLE public.loan_item_catalog
  ADD COLUMN IF NOT EXISTS stock_total   integer,
  ADD COLUMN IF NOT EXISTS min_available integer CHECK (min_available >= 0),
  ADD COLUMN IF NOT EXISTS is_active     boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.loan_item_catalog.stock_total IS
  'Piezas que tiene el hotel. NULL = nunca se ha contado. Solo cambia vía register_loan_stock_movement y faltantes.';
COMMENT ON COLUMN public.loan_item_catalog.min_available IS
  'Alerta cuando los disponibles (existencia − prestados − sin revisar) bajan de este número';

-- ── 3. Bitácora de movimientos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loan_item_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_item_id uuid NOT NULL REFERENCES public.loan_item_catalog(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('ENTRADA', 'BAJA', 'CONTEO', 'FALTANTE', 'FALTANTE_REVERTIDO')),
  delta        integer NOT NULL,
  stock_after  integer NOT NULL,
  reason       text,
  loan_id      uuid REFERENCES public.stay_loaned_items(id) ON DELETE SET NULL,
  employee_id  uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loan_item_movements_item ON public.loan_item_movements (loan_item_id, created_at DESC);

ALTER TABLE public.loan_item_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loan_item_movements_select ON public.loan_item_movements;
CREATE POLICY loan_item_movements_select ON public.loan_item_movements
  FOR SELECT TO authenticated USING (true);
-- Sin políticas de escritura: solo las funciones (SECURITY DEFINER) registran movimientos.
REVOKE INSERT, UPDATE, DELETE ON public.loan_item_movements FROM anon, authenticated;

-- ── 4. Movimiento manual (admin): ENTRADA / BAJA / CONTEO ────────────────────
CREATE OR REPLACE FUNCTION public.register_loan_stock_movement(
    p_loan_item_id uuid, p_kind text, p_quantity integer, p_reason text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_emp    employees%ROWTYPE;
    v_item   loan_item_catalog%ROWTYPE;
    v_delta  integer;
    v_after  integer;
    v_reason text := nullif(trim(p_reason), '');
BEGIN
    SELECT * INTO v_emp FROM employees
     WHERE auth_user_id = auth.uid() AND is_active AND deleted_at IS NULL
       AND role IN ('admin', 'manager', 'gerente', 'supervisor')
     LIMIT 1;
    IF v_emp.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo administración puede mover existencias');
    END IF;

    IF p_kind NOT IN ('ENTRADA', 'BAJA', 'CONTEO') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Movimiento inválido');
    END IF;
    IF p_quantity IS NULL OR p_quantity < 0 OR (p_kind <> 'CONTEO' AND p_quantity = 0) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cantidad inválida');
    END IF;
    IF p_kind = 'BAJA' AND v_reason IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Indica el motivo de la baja');
    END IF;

    SELECT * INTO v_item FROM loan_item_catalog WHERE id = p_loan_item_id FOR UPDATE;
    IF v_item.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Artículo no encontrado');
    END IF;
    IF v_item.stock_total IS NULL AND p_kind <> 'CONTEO' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Primero registra un conteo físico de este artículo');
    END IF;

    v_delta := CASE p_kind
                 WHEN 'ENTRADA' THEN p_quantity
                 WHEN 'BAJA'    THEN -p_quantity
                 ELSE p_quantity - coalesce(v_item.stock_total, 0)
               END;
    v_after := coalesce(v_item.stock_total, 0) + v_delta;
    IF v_after < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', format('La baja deja la existencia en negativo (hay %s)', v_item.stock_total));
    END IF;

    UPDATE loan_item_catalog SET stock_total = v_after, updated_at = now() WHERE id = p_loan_item_id;
    INSERT INTO loan_item_movements (loan_item_id, kind, delta, stock_after, reason, employee_id)
    VALUES (p_loan_item_id, p_kind, v_delta, v_after,
            coalesce(v_reason, CASE WHEN p_kind = 'CONTEO' AND v_item.stock_total IS NULL THEN 'Conteo inicial' END),
            v_emp.id);

    RETURN jsonb_build_object('success', true, 'stock_total', v_after, 'delta', v_delta);
END;
$function$;

-- ── 5. Faltantes mueven la existencia ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.track_loan_stock_on_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_delta integer;
    v_kind  text;
    v_after integer;
    v_room  text;
BEGIN
    IF NEW.status = 'PERDIDO' AND OLD.status IS DISTINCT FROM 'PERDIDO' THEN
        v_delta := -NEW.quantity; v_kind := 'FALTANTE';
    ELSIF OLD.status = 'PERDIDO' AND NEW.status IS DISTINCT FROM 'PERDIDO' THEN
        v_delta := NEW.quantity;  v_kind := 'FALTANTE_REVERTIDO';
    ELSE
        RETURN NEW;
    END IF;

    UPDATE loan_item_catalog
       SET stock_total = stock_total + v_delta, updated_at = now()
     WHERE id = NEW.loan_item_id AND stock_total IS NOT NULL
    RETURNING stock_total INTO v_after;

    IF FOUND THEN
        SELECT r.number INTO v_room FROM room_stays s JOIN rooms r ON r.id = s.room_id WHERE s.id = NEW.room_stay_id;
        INSERT INTO loan_item_movements (loan_item_id, kind, delta, stock_after, reason, loan_id, employee_id)
        VALUES (NEW.loan_item_id, v_kind, v_delta, v_after, 'Hab. ' || coalesce(v_room, '?'), NEW.id, NEW.checked_by);
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- El control de existencias nunca bloquea la revisión de un préstamo
    RAISE WARNING 'track_loan_stock_on_status: %', SQLERRM;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_track_loan_stock ON public.stay_loaned_items;
CREATE TRIGGER tr_track_loan_stock
  AFTER UPDATE OF status ON public.stay_loaned_items
  FOR EACH ROW EXECUTE FUNCTION public.track_loan_stock_on_status();

-- ── 6. Artículos inactivos ya no se prestan ──────────────────────────────────
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
        JOIN loan_item_catalog c ON c.id = pll.loan_item_id AND c.is_active
        WHERE pll.product_id = NEW.product_id;
    END IF;

    RETURN NEW;
END;
$function$;

-- ── 7. Resumen de inventario ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_loan_inventory()
 RETURNS TABLE (
    id uuid, name text, icon text, damage_price numeric, is_active boolean,
    stock_total integer, min_available integer,
    in_rooms integer, unchecked_closed integer, available integer,
    lost_30d integer, last_count_at timestamptz)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $function$
    SELECT c.id, c.name, c.icon, c.damage_price, c.is_active, c.stock_total, c.min_available,
           coalesce(o.in_rooms, 0), coalesce(o.unchecked_closed, 0),
           CASE WHEN c.stock_total IS NULL THEN NULL
                ELSE c.stock_total - coalesce(o.in_rooms, 0) - coalesce(o.unchecked_closed, 0) END,
           coalesce(lost.qty, 0),
           cnt.at
    FROM loan_item_catalog c
    LEFT JOIN LATERAL (
        SELECT sum(l.quantity) FILTER (WHERE s.status = 'ACTIVA')::int  AS in_rooms,
               sum(l.quantity) FILTER (WHERE s.status <> 'ACTIVA')::int AS unchecked_closed
        FROM stay_loaned_items l JOIN room_stays s ON s.id = l.room_stay_id
        WHERE l.loan_item_id = c.id AND l.status = 'PRESTADO'
    ) o ON true
    LEFT JOIN LATERAL (
        SELECT sum(l.quantity)::int AS qty FROM stay_loaned_items l
        WHERE l.loan_item_id = c.id AND l.status = 'PERDIDO' AND l.checked_at > now() - interval '30 days'
    ) lost ON true
    LEFT JOIN LATERAL (
        SELECT max(m.created_at) AS at FROM loan_item_movements m
        WHERE m.loan_item_id = c.id AND m.kind = 'CONTEO'
    ) cnt ON true
    ORDER BY c.is_active DESC, c.name;
$function$;

REVOKE EXECUTE ON FUNCTION public.register_loan_stock_movement(uuid, text, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.track_loan_stock_on_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_loan_inventory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_loan_stock_movement(uuid, text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_loan_inventory() TO authenticated, service_role;

COMMIT;

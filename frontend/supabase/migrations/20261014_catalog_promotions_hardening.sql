-- ════════════════════════════════════════════════════════════════════════════
-- Catálogo y promociones: auditoría 2026-10-14
--
-- 1. Promociones de Halloween (7, 20% en disfraces y lencería): el formulario recorría la
--    vigencia 6 h en cada edición (mostraba UTC como hora local). Se dejan del 15-oct 00:00 al
--    31-oct 23:59 hora local (UTC-6) y se corrigen los nombres con faltas/espacios dobles.
-- 2. Reglas en la base para promociones (ningún cliente puede saltárselas):
--    NxM con N > M ≥ 1 · % entre 0 y 100 (sin incluir 100: un regalo es cortesía con motivo) ·
--    precio fijo solo por producto y menor que su precio · alcance = producto XOR categoría ·
--    subcategoría solo con categoría · fin después del inicio.
-- 3. Permisos: promociones, paquetes de botella, productos, categorías y subcategorías solo los
--    modifica administración (admin, manager, gerente, supervisor); todos con sesión pueden leer.
--    Antes cualquier usuario con sesión (incl. cocheros) podía crearlos, editarlos o borrarlos,
--    y subcategorías no tenía RLS. Ninguna función ni trigger de ventas escribe en estas tablas.
-- 4. Bitácora (audit_logs) de altas, cambios y bajas de promociones y reglas de paquete, y de
--    cambios de precio, nombre o estado de productos.
-- 5. Nombres de producto sin espacios al inicio/fin ni dobles (37 productos), y así en adelante.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. Halloween ─────────────────────────────────────────────────────────────
UPDATE public.product_promotions
   SET start_date = '2026-10-15 06:00:00+00', end_date = '2026-11-01 05:59:59+00', updated_at = now()
 WHERE id IN ('4f5084b7-0509-4973-8044-f8c3cf3dcb68', 'f62c1d5b-612c-4305-8fce-fc05333460c9',
              '8234cd24-b9aa-4325-9978-e517dfb22ad6', 'd9225145-e2cb-44f7-97e1-d582d4ccd74f',
              '05c8aee7-1691-425f-9be0-af5a296c9223', 'fa439838-4e89-4938-afcf-f20e400b170b',
              '01c1b9ea-50d3-4c89-a32c-a929ac87bdeb');
UPDATE public.product_promotions SET name = 'DISFRAZ COLEGIALA' WHERE id = 'd9225145-e2cb-44f7-97e1-d582d4ccd74f';
UPDATE public.product_promotions SET name = 'DISFRAZ MUCAMA'    WHERE id = '05c8aee7-1691-425f-9be0-af5a296c9223';
UPDATE public.product_promotions SET name = 'LENCERIA NEGRA'    WHERE id = 'fa439838-4e89-4938-afcf-f20e400b170b';

-- ── 2. Reglas de promociones ─────────────────────────────────────────────────
ALTER TABLE public.product_promotions DROP CONSTRAINT IF EXISTS product_promotions_values_check;
ALTER TABLE public.product_promotions ADD CONSTRAINT product_promotions_values_check CHECK (
  CASE promo_type
    WHEN 'NxM' THEN buy_quantity >= 2 AND pay_quantity >= 1 AND pay_quantity < buy_quantity
    WHEN 'PERCENT_DISCOUNT' THEN discount_percent > 0 AND discount_percent < 100
    WHEN 'FIXED_PRICE' THEN fixed_price > 0 AND product_id IS NOT NULL
    ELSE false
  END);

ALTER TABLE public.product_promotions DROP CONSTRAINT IF EXISTS product_promotions_scope_check;
ALTER TABLE public.product_promotions ADD CONSTRAINT product_promotions_scope_check CHECK (
  (product_id IS NOT NULL) <> (category_id IS NOT NULL)
  AND (subcategory_id IS NULL OR category_id IS NOT NULL));

ALTER TABLE public.product_promotions DROP CONSTRAINT IF EXISTS product_promotions_dates_check;
ALTER TABLE public.product_promotions ADD CONSTRAINT product_promotions_dates_check CHECK (
  start_date IS NULL OR end_date IS NULL OR end_date > start_date);

-- Precio fijo menor que el precio del producto (regla entre tablas: trigger)
CREATE OR REPLACE FUNCTION public.validate_product_promotion()
 RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $function$
DECLARE
    v_price numeric;
BEGIN
    IF NEW.promo_type = 'FIXED_PRICE' THEN
        SELECT price INTO v_price FROM products WHERE id = NEW.product_id;
        IF v_price IS NOT NULL AND NEW.fixed_price >= v_price THEN
            RAISE EXCEPTION 'El precio especial ($%) debe ser menor que el precio normal del producto ($%)', NEW.fixed_price, v_price
                  USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS tr_validate_product_promotion ON public.product_promotions;
CREATE TRIGGER tr_validate_product_promotion
  BEFORE INSERT OR UPDATE ON public.product_promotions
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_promotion();

-- ── 3. Permisos ──────────────────────────────────────────────────────────────
-- promociones
DROP POLICY IF EXISTS "Authenticated users can delete promotions" ON public.product_promotions;
DROP POLICY IF EXISTS "Authenticated users can insert promotions" ON public.product_promotions;
DROP POLICY IF EXISTS "Authenticated users can update promotions" ON public.product_promotions;
DROP POLICY IF EXISTS product_promotions_write_admin ON public.product_promotions;
CREATE POLICY product_promotions_write_admin ON public.product_promotions FOR ALL TO authenticated
  USING (has_role(ARRAY['admin', 'manager', 'gerente', 'supervisor']))
  WITH CHECK (has_role(ARRAY['admin', 'manager', 'gerente', 'supervisor']));

-- reglas de paquete
DROP POLICY IF EXISTS "Allow modifications for authenticated users" ON public.bottle_package_rules;
DROP POLICY IF EXISTS bottle_package_rules_write_admin ON public.bottle_package_rules;
CREATE POLICY bottle_package_rules_write_admin ON public.bottle_package_rules FOR ALL TO authenticated
  USING (has_role(ARRAY['admin', 'manager', 'gerente', 'supervisor']))
  WITH CHECK (has_role(ARRAY['admin', 'manager', 'gerente', 'supervisor']));

-- productos
DROP POLICY IF EXISTS products_delete_authenticated ON public.products;
DROP POLICY IF EXISTS products_insert_authenticated ON public.products;
DROP POLICY IF EXISTS products_update_authenticated ON public.products;
DROP POLICY IF EXISTS products_write_admin ON public.products;
CREATE POLICY products_write_admin ON public.products FOR ALL TO authenticated
  USING (has_role(ARRAY['admin', 'manager', 'gerente', 'supervisor']))
  WITH CHECK (has_role(ARRAY['admin', 'manager', 'gerente', 'supervisor']));

-- categorías (lectura igual que hoy para personal; escritura solo administración)
DROP POLICY IF EXISTS categories_update_ops ON public.categories;
DROP POLICY IF EXISTS categories_write_ops ON public.categories;
DROP POLICY IF EXISTS categories_delete_admin ON public.categories;
DROP POLICY IF EXISTS categories_write_admin ON public.categories;
CREATE POLICY categories_write_admin ON public.categories FOR ALL TO authenticated
  USING (has_role(ARRAY['admin', 'manager', 'gerente', 'supervisor']))
  WITH CHECK (has_role(ARRAY['admin', 'manager', 'gerente', 'supervisor']));

-- subcategorías: no tenía RLS
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subcategories_select_auth ON public.subcategories;
DROP POLICY IF EXISTS subcategories_write_admin ON public.subcategories;
CREATE POLICY subcategories_select_auth ON public.subcategories FOR SELECT TO authenticated USING (true);
CREATE POLICY subcategories_write_admin ON public.subcategories FOR ALL TO authenticated
  USING (has_role(ARRAY['admin', 'manager', 'gerente', 'supervisor']))
  WITH CHECK (has_role(ARRAY['admin', 'manager', 'gerente', 'supervisor']));

-- ── 4. Bitácora ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_catalog_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
    v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
    v_id  uuid  := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid);
    v_name text := coalesce(v_new->>'name', v_old->>'name', v_new->>'unit_type', v_old->>'unit_type');
BEGIN
    -- Productos: solo cambios de precio, nombre o estado (no cada edición menor)
    IF TG_TABLE_NAME = 'products' AND TG_OP = 'UPDATE'
       AND (v_old->>'price') IS NOT DISTINCT FROM (v_new->>'price')
       AND (v_old->>'name') IS NOT DISTINCT FROM (v_new->>'name')
       AND (v_old->>'is_active') IS NOT DISTINCT FROM (v_new->>'is_active') THEN
        RETURN NEW;
    END IF;

    PERFORM log_audit(
        'CATALOG_CHANGE', TG_TABLE_NAME, v_id,
        CASE TG_OP WHEN 'INSERT' THEN 'CREATE' WHEN 'UPDATE' THEN 'UPDATE' ELSE 'DELETE' END,
        v_old, v_new,
        format('%s %s: %s', TG_TABLE_NAME, lower(TG_OP), coalesce(v_name, v_id::text)),
        '{}'::jsonb,
        CASE WHEN TG_TABLE_NAME = 'product_promotions'
                  OR (TG_TABLE_NAME = 'products' AND TG_OP = 'UPDATE' AND (v_old->>'price') IS DISTINCT FROM (v_new->>'price'))
             THEN 'WARNING' ELSE 'INFO' END);
    RETURN coalesce(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit_catalog_change: %', SQLERRM; -- la bitácora nunca bloquea el cambio
    RETURN coalesce(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS tr_audit_product_promotions ON public.product_promotions;
CREATE TRIGGER tr_audit_product_promotions AFTER INSERT OR UPDATE OR DELETE ON public.product_promotions
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalog_change();
DROP TRIGGER IF EXISTS tr_audit_bottle_package_rules ON public.bottle_package_rules;
CREATE TRIGGER tr_audit_bottle_package_rules AFTER INSERT OR UPDATE OR DELETE ON public.bottle_package_rules
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalog_change();
DROP TRIGGER IF EXISTS tr_audit_products ON public.products;
CREATE TRIGGER tr_audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.audit_catalog_change();

-- ── 5. Nombres de producto limpios ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_product_name()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.name := regexp_replace(btrim(NEW.name), '\s{2,}', ' ', 'g');
    RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS tr_normalize_product_name ON public.products;
CREATE TRIGGER tr_normalize_product_name BEFORE INSERT OR UPDATE OF name ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.normalize_product_name();

UPDATE public.products SET name = name
 WHERE name <> regexp_replace(btrim(name), '\s{2,}', ' ', 'g');

REVOKE EXECUTE ON FUNCTION public.audit_catalog_change() FROM PUBLIC, anon, authenticated;

COMMIT;

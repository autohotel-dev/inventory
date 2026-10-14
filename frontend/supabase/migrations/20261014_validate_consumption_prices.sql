-- ════════════════════════════════════════════════════════════════════════════
-- Validación en la base del precio de los consumos (2026-10-14)
--
-- El carrito calcula promociones y paquetes en la computadora de recepción y manda el precio
-- ya hecho. La base no lo revisaba: cualquier precio entraba. Ahora, al insertar renglones
-- CONSUMPTION (todos los de una misma inserción se revisan juntos), cada uno debe ser:
--   - precio de lista del producto, o
--   - el precio de una promoción vigente que aplique al producto (% o precio especial); si es
--     "solo la primera pieza por estancia": 1 pieza y nada de ese alcance consumido antes, o
--   - cortesía "Promoción <nombre>" (regalo de NxM): no más piezas de regalo de las que dan
--     las piezas pagadas en esa misma captura (1 paquete si es "solo primera vez"), o
--   - cortesía "Incluido en paquete…": no más bebidas de esa categoría que las que dan las
--     botellas con regla de paquete en la cuenta, o
--   - otra cortesía: con motivo escrito.
-- Lo mismo que hace lib/promotions/engine.ts; si no coincide, la captura se rechaza completa
-- con un mensaje que dice qué renglón y por qué.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE OR REPLACE FUNCTION public.validate_consumption_prices()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    r         record;
    v_prod    products%ROWTYPE;
    v_promo   product_promotions%ROWTYPE;
    v_ok      boolean;
    v_first   boolean;
    v_n       integer;
    v_m       integer;
    v_units   numeric;
    v_gifts   numeric;
    v_allowed numeric;
    v_used    numeric;
BEGIN
    FOR r IN
        SELECT * FROM new_items
         WHERE concept_type = 'CONSUMPTION' AND product_id IS NOT NULL AND NOT coalesce(is_cancelled, false)
    LOOP
        SELECT * INTO v_prod FROM products WHERE id = r.product_id;

        -- ── Precio cobrado ──────────────────────────────────────────────────────
        IF NOT coalesce(r.is_courtesy, false) THEN
            IF abs(r.unit_price - v_prod.price) < 0.005 THEN
                CONTINUE;
            END IF;

            v_ok := false;
            FOR v_promo IN
                SELECT pp.* FROM product_promotions pp
                 WHERE pp.is_active
                   AND (pp.start_date IS NULL OR pp.start_date <= now())
                   AND (pp.end_date IS NULL OR pp.end_date >= now())
                   AND pp.promo_type IN ('PERCENT_DISCOUNT', 'FIXED_PRICE')
                   AND (pp.product_id = v_prod.id
                        OR (pp.product_id IS NULL AND pp.subcategory_id IS NOT NULL AND pp.subcategory_id = v_prod.subcategory_id)
                        OR (pp.product_id IS NULL AND pp.subcategory_id IS NULL AND pp.category_id = v_prod.category_id))
            LOOP
                IF abs(r.unit_price - CASE v_promo.promo_type
                        WHEN 'PERCENT_DISCOUNT' THEN round(v_prod.price * (1 - v_promo.discount_percent / 100), 2)
                        ELSE round(least(v_promo.fixed_price, v_prod.price), 2) END) < 0.005 THEN
                    v_first := coalesce((v_promo.conditions->>'first_order_only')::boolean, false);
                    IF NOT v_first THEN
                        v_ok := true;
                    ELSIF r.qty = 1
                      AND NOT EXISTS (   -- nada del alcance consumido antes en la estancia
                          SELECT 1 FROM sales_order_items i JOIN products p ON p.id = i.product_id
                           WHERE i.sales_order_id = r.sales_order_id AND i.concept_type = 'CONSUMPTION'
                             AND NOT coalesce(i.is_cancelled, false)
                             AND i.id NOT IN (SELECT id FROM new_items)
                             AND CASE WHEN v_promo.product_id IS NOT NULL THEN p.id = v_promo.product_id
                                      WHEN v_promo.subcategory_id IS NOT NULL THEN p.subcategory_id = v_promo.subcategory_id
                                      ELSE p.category_id = v_promo.category_id END)
                      AND (SELECT count(*) FROM new_items n JOIN products p ON p.id = n.product_id   -- una sola pieza con promoción
                            WHERE n.sales_order_id = r.sales_order_id AND n.concept_type = 'CONSUMPTION'
                              AND NOT coalesce(n.is_courtesy, false) AND n.unit_price < p.price
                              AND CASE WHEN v_promo.product_id IS NOT NULL THEN p.id = v_promo.product_id
                                       WHEN v_promo.subcategory_id IS NOT NULL THEN p.subcategory_id = v_promo.subcategory_id
                                       ELSE p.category_id = v_promo.category_id END) = 1 THEN
                        v_ok := true;
                    END IF;
                END IF;
                EXIT WHEN v_ok;
            END LOOP;

            IF NOT v_ok THEN
                RAISE EXCEPTION 'Precio no válido para %: $% (precio de lista $%). Si es promoción, ya no está vigente o ya se usó en esta estancia; cierra y vuelve a abrir el carrito.',
                      v_prod.name, r.unit_price, v_prod.price USING ERRCODE = 'check_violation';
            END IF;
            CONTINUE;
        END IF;

        -- ── Cortesías ──────────────────────────────────────────────────────────
        IF coalesce(r.courtesy_reason, '') ILIKE 'Promoción %' THEN
            SELECT pp.* INTO v_promo FROM product_promotions pp
             WHERE pp.name = substr(r.courtesy_reason, length('Promoción ') + 1)
               AND pp.promo_type = 'NxM' AND pp.is_active
               AND (pp.start_date IS NULL OR pp.start_date <= now())
               AND (pp.end_date IS NULL OR pp.end_date >= now())
               AND (pp.product_id = v_prod.id
                    OR (pp.product_id IS NULL AND pp.subcategory_id IS NOT NULL AND pp.subcategory_id = v_prod.subcategory_id)
                    OR (pp.product_id IS NULL AND pp.subcategory_id IS NULL AND pp.category_id = v_prod.category_id))
             LIMIT 1;
            IF v_promo.id IS NULL THEN
                RAISE EXCEPTION 'Regalo de promoción no válido para %: "%" no está vigente para este producto. Cierra y vuelve a abrir el carrito.',
                      v_prod.name, substr(r.courtesy_reason, length('Promoción ') + 1) USING ERRCODE = 'check_violation';
            END IF;
            v_n := v_promo.buy_quantity; v_m := v_promo.pay_quantity;
            SELECT coalesce(sum(qty) FILTER (WHERE NOT coalesce(is_courtesy, false)), 0) + coalesce(sum(qty) FILTER (WHERE is_courtesy AND courtesy_reason = r.courtesy_reason), 0),
                   coalesce(sum(qty) FILTER (WHERE is_courtesy AND courtesy_reason = r.courtesy_reason), 0)
              INTO v_units, v_gifts
              FROM new_items WHERE sales_order_id = r.sales_order_id AND product_id = r.product_id AND concept_type = 'CONSUMPTION';
            v_allowed := floor(v_units / v_n) * (v_n - v_m);
            IF coalesce((v_promo.conditions->>'first_order_only')::boolean, false) THEN
                v_allowed := least(v_allowed, v_n - v_m);
                IF EXISTS (SELECT 1 FROM sales_order_items i WHERE i.sales_order_id = r.sales_order_id AND i.product_id = r.product_id
                             AND i.concept_type = 'CONSUMPTION' AND NOT coalesce(i.is_cancelled, false)
                             AND i.id NOT IN (SELECT id FROM new_items)) THEN
                    v_allowed := 0;
                END IF;
            END IF;
            IF v_gifts > v_allowed THEN
                RAISE EXCEPTION 'Demasiadas piezas de regalo de % por "%": % (corresponden %).', v_prod.name, v_promo.name, v_gifts, v_allowed
                      USING ERRCODE = 'check_violation';
            END IF;

        ELSIF coalesce(r.courtesy_reason, '') ILIKE 'Incluido en paquete%' THEN
            -- bebidas que dan las botellas de la cuenta (las ya capturadas y las de esta captura)
            SELECT coalesce(sum(i.qty * br.quantity), 0) INTO v_allowed
              FROM sales_order_items i
              JOIN products b ON b.id = i.product_id
              JOIN bottle_package_rules br ON br.unit_type = b.unit AND br.subcategory_id = b.subcategory_id AND br.is_active
             WHERE i.sales_order_id = r.sales_order_id AND i.concept_type = 'CONSUMPTION'
               AND NOT coalesce(i.is_courtesy, false) AND NOT coalesce(i.is_cancelled, false)
               AND br.included_category_id = v_prod.category_id;
            SELECT coalesce(sum(i.qty), 0) INTO v_used
              FROM sales_order_items i JOIN products p ON p.id = i.product_id
             WHERE i.sales_order_id = r.sales_order_id AND i.concept_type = 'CONSUMPTION'
               AND i.is_courtesy AND i.courtesy_reason ILIKE 'Incluido en paquete%' AND NOT coalesce(i.is_cancelled, false)
               AND p.category_id = v_prod.category_id;
            IF v_used > v_allowed THEN
                RAISE EXCEPTION 'Bebidas de paquete de más (%): % incluidas, las botellas de esta cuenta dan %.', v_prod.name, v_used, v_allowed
                      USING ERRCODE = 'check_violation';
            END IF;

        ELSIF nullif(btrim(coalesce(r.courtesy_reason, '')), '') IS NULL THEN
            RAISE EXCEPTION 'La cortesía de % necesita un motivo.', v_prod.name USING ERRCODE = 'check_violation';
        END IF;
    END LOOP;

    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS tr_validate_consumption_prices ON public.sales_order_items;
CREATE TRIGGER tr_validate_consumption_prices
  AFTER INSERT ON public.sales_order_items
  REFERENCING NEW TABLE AS new_items
  FOR EACH STATEMENT EXECUTE FUNCTION public.validate_consumption_prices();

REVOKE EXECUTE ON FUNCTION public.validate_consumption_prices() FROM PUBLIC, anon, authenticated;

COMMIT;

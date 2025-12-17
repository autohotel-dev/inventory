-- Agregar campo is_paid a sales_order_items
-- Permite rastrear si cada concepto individual ha sido pagado

-- 1. Agregar columna is_paid (default false = pendiente)
ALTER TABLE sales_order_items 
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

-- 2. Agregar columna paid_at para registrar cuándo se pagó
ALTER TABLE sales_order_items 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 3. Agregar columna concept_type para categorizar el tipo de cargo
-- Esto ayuda a distinguir entre: habitación base, hora extra, persona extra, consumo, etc.
ALTER TABLE sales_order_items 
ADD COLUMN IF NOT EXISTS concept_type TEXT DEFAULT 'PRODUCT'
CHECK (concept_type IN ('ROOM_BASE', 'EXTRA_HOUR', 'EXTRA_PERSON', 'CONSUMPTION', 'PRODUCT', 'OTHER'));

-- 4. Comentarios para documentación
COMMENT ON COLUMN sales_order_items.is_paid IS 'Indica si este concepto ya fue pagado';
COMMENT ON COLUMN sales_order_items.paid_at IS 'Fecha y hora en que se pagó este concepto';
COMMENT ON COLUMN sales_order_items.concept_type IS 'Tipo de concepto: ROOM_BASE, EXTRA_HOUR, EXTRA_PERSON, CONSUMPTION, PRODUCT, OTHER';

-- 5. Crear índice para búsquedas rápidas de items pendientes
CREATE INDEX IF NOT EXISTS idx_sales_order_items_is_paid ON sales_order_items(is_paid);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_concept_type ON sales_order_items(concept_type);

-- 6. Función para recalcular remaining_amount basado en items no pagados
CREATE OR REPLACE FUNCTION recalculate_remaining_amount(order_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    unpaid_total DECIMAL(10,2) := 0;
BEGIN
    -- Sumar solo los items que NO están pagados
    SELECT COALESCE(SUM(total), 0)
    INTO unpaid_total
    FROM sales_order_items
    WHERE sales_order_id = order_id AND (is_paid = FALSE OR is_paid IS NULL);

    -- Actualizar el remaining_amount en la orden
    UPDATE sales_orders
    SET remaining_amount = unpaid_total
    WHERE id = order_id;

    RETURN unpaid_total;
END;
$$ LANGUAGE plpgsql;

-- 7. Función para marcar items como pagados y actualizar remaining_amount
CREATE OR REPLACE FUNCTION mark_items_as_paid(item_ids UUID[], p_payment_method TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    order_id UUID;
BEGIN
    -- Obtener el order_id del primer item
    SELECT sales_order_id INTO order_id
    FROM sales_order_items
    WHERE id = item_ids[1];

    -- Marcar los items como pagados
    UPDATE sales_order_items
    SET 
        is_paid = TRUE,
        paid_at = NOW(),
        payment_method = COALESCE(p_payment_method, payment_method)
    WHERE id = ANY(item_ids);

    -- Recalcular el remaining_amount
    PERFORM recalculate_remaining_amount(order_id);
END;
$$ LANGUAGE plpgsql;

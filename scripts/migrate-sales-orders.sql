-- Script de migración para actualizar tabla sales_orders existente
-- Respeta tu estructura actual y añade campos necesarios para estadísticas

-- 1. Agregar campos faltantes a sales_orders (CORREGIDO)
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS order_number VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS order_date TIMESTAMP WITH TIME ZONE;

-- 2. Crear función para generar números de orden únicos
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    order_num VARCHAR(50);
    counter INTEGER := 1;
    current_year INTEGER;
BEGIN
    -- Usar order_date si existe, sino usar created_at
    current_year := EXTRACT(YEAR FROM COALESCE(NEW.order_date, NEW.created_at, NOW()));

    -- Si order_number ya tiene valor, no generar nuevo
    IF NEW.order_number IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Generar número único con formato SO-YYYY-NNNN
    LOOP
        order_num := 'SO-' || current_year::TEXT || '-' || LPAD(counter::TEXT, 4, '0');

        -- Verificar si ya existe
        SELECT COUNT(*) INTO counter
        FROM sales_orders
        WHERE order_number = order_num;

        EXIT WHEN counter = 0;
        counter := counter + 1;
    END LOOP;

    NEW.order_number := order_num;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear función para establecer order_date cuando sea NULL
CREATE OR REPLACE FUNCTION set_order_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_date IS NULL THEN
        NEW.order_date := COALESCE(NEW.created_at, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Crear triggers (orden correcto: primero order_date, luego order_number)
DROP TRIGGER IF EXISTS trg_set_order_date ON sales_orders;
CREATE TRIGGER trg_set_order_date
    BEFORE INSERT ON sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_date();

DROP TRIGGER IF EXISTS trg_generate_order_number ON sales_orders;
CREATE TRIGGER trg_generate_order_number
    BEFORE INSERT ON sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION generate_order_number();

-- 5. Actualizar registros existentes sin order_number (CORREGIDO)
DO $$
DECLARE
    sales_record RECORD;
    order_counter INTEGER := 1;
    current_year INTEGER;
BEGIN
    -- Para cada registro existente, generar número único
    FOR sales_record IN
        SELECT id, created_at
        FROM sales_orders
        WHERE order_number IS NULL
        ORDER BY created_at
    LOOP
        current_year := EXTRACT(YEAR FROM sales_record.created_at);

        -- Generar número único para este año
        WHILE EXISTS(
            SELECT 1 FROM sales_orders
            WHERE order_number = 'SO-' || current_year::TEXT || '-' || LPAD(order_counter::TEXT, 4, '0')
        ) LOOP
            order_counter := order_counter + 1;
        END LOOP;

        -- Actualizar el registro con el número único generado
        UPDATE sales_orders
        SET order_number = 'SO-' || current_year::TEXT || '-' || LPAD(order_counter::TEXT, 4, '0')
        WHERE id = sales_record.id;

        order_counter := order_counter + 1;
    END LOOP;
END $$;

-- 6. Hacer order_number NOT NULL después de actualizar
ALTER TABLE sales_orders
ALTER COLUMN order_number SET NOT NULL;

-- 7. Crear función para calcular estadísticas basada en tu estructura (CORREGIDA)
CREATE OR REPLACE FUNCTION get_customer_statistics()
RETURNS TABLE (
    customer_id UUID,
    total_orders BIGINT,
    total_spent DECIMAL(18,6),
    last_order_date TIMESTAMP WITH TIME ZONE,
    customer_type VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        COUNT(DISTINCT so.id)::BIGINT,
        COALESCE(SUM(so.total), 0)::DECIMAL(18,6),
        MAX(so.created_at),
        CASE
            WHEN COALESCE(SUM(so.total), 0) > 5000 THEN 'vip'::VARCHAR(20)
            WHEN COUNT(DISTINCT so.id) > 5 THEN 'regular'::VARCHAR(20)
            ELSE 'new'::VARCHAR(20)
        END
    FROM customers c
    LEFT JOIN sales_orders so ON c.id = so.customer_id
        AND so.status NOT IN ('CANCELLED')
        AND so.total > 0
    WHERE c.is_active = true
    GROUP BY c.id
    ORDER BY COALESCE(SUM(so.total), 0) DESC, COUNT(DISTINCT so.id) DESC;
END;
$$ LANGUAGE plpgsql;

-- 8. Crear vista mejorada usando tu estructura (CORREGIDA)
CREATE OR REPLACE VIEW customer_statistics_view AS
SELECT
    c.id,
    c.name,
    c.email,
    COUNT(DISTINCT so.id)::BIGINT as total_orders,
    COALESCE(SUM(so.total), 0)::DECIMAL(18,6) as total_spent,
    COALESCE(SUM(so.subtotal), 0)::DECIMAL(18,6) as subtotal,
    COALESCE(SUM(so.tax), 0)::DECIMAL(18,6) as total_tax,
    MAX(so.created_at) as last_order_date,
    so.currency,
    CASE
        WHEN COALESCE(SUM(so.total), 0) > 5000 THEN 'vip'::VARCHAR(20)
        WHEN COUNT(DISTINCT so.id) > 5 THEN 'regular'::VARCHAR(20)
        ELSE 'new'::VARCHAR(20)
    END as customer_type
FROM customers c
LEFT JOIN sales_orders so ON c.id = so.customer_id
    AND so.status NOT IN ('CANCELLED')
    AND so.total > 0
WHERE c.is_active = true
GROUP BY c.id, c.name, c.email, so.currency;

-- 9. Crear tabla para detalles de órdenes si no existe
CREATE TABLE IF NOT EXISTS sales_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(18,6) NOT NULL,
  total_price DECIMAL(18,6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Crear índices adicionales para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_number ON sales_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_status ON sales_orders(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_product ON sales_order_items(product_id);

-- 11. Insertar algunos datos de prueba respetando tu estructura
INSERT INTO customers (name, email, phone, is_active) VALUES
('Cliente VIP Prueba', 'vip@prueba.com', '+52551234567', true),
('Cliente Regular Prueba', 'regular@prueba.com', '+52559876543', true)
ON CONFLICT DO NOTHING;

-- 12. Insertar órdenes de prueba (SIN order_number - el trigger lo genera)
INSERT INTO sales_orders (customer_id, warehouse_id, status, subtotal, tax, total, notes, created_by) VALUES
(
    (SELECT id FROM customers WHERE email = 'vip@prueba.com' LIMIT 1),
    (SELECT id FROM warehouses LIMIT 1),
    'DELIVERED',
    4500.00,
    720.00,
    5220.00,
    'Orden de prueba VIP',
    (SELECT id FROM auth.users LIMIT 1)
),
(
    (SELECT id FROM customers WHERE email = 'regular@prueba.com' LIMIT 1),
    (SELECT id FROM warehouses LIMIT 1),
    'DELIVERED',
    1200.00,
    192.00,
    1392.00,
    'Orden de prueba regular',
    (SELECT id FROM auth.users LIMIT 1)
)
ON CONFLICT DO NOTHING;

-- 13. Función para actualizar el procedimiento almacenado si necesitas cambios
-- Para ejecutar cambios futuros, simplemente reemplaza la función:
-- DROP FUNCTION IF EXISTS get_customer_statistics();
-- CREATE OR REPLACE FUNCTION get_customer_statistics() ...

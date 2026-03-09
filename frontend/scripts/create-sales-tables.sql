-- Script para crear tablas de ventas y órdenes
-- Ejecuta este script en Supabase SQL Editor

-- 1. Crear tabla de órdenes de venta
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED')) DEFAULT 'PENDING',
  notes TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear tabla de detalles de órdenes de venta
CREATE TABLE IF NOT EXISTS sales_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Crear tabla de órdenes de compra
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('PENDING', 'CONFIRMED', 'RECEIVED', 'CANCELLED')) DEFAULT 'PENDING',
  notes TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Crear tabla de detalles de órdenes de compra
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_product ON sales_order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON purchase_order_items(product_id);

-- 6. Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Crear triggers para updated_at
DROP TRIGGER IF EXISTS update_sales_orders_updated_at ON sales_orders;
CREATE TRIGGER update_sales_orders_updated_at
    BEFORE UPDATE ON sales_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Crear función para calcular el total de una orden de venta
CREATE OR REPLACE FUNCTION calculate_sales_order_total(order_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    total DECIMAL(10,2) := 0;
BEGIN
    SELECT COALESCE(SUM(total_price), 0)
    INTO total
    FROM sales_order_items
    WHERE sales_order_id = order_id;

    -- Actualizar el total en la orden
    UPDATE sales_orders
    SET total_amount = total
    WHERE id = order_id;

    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- 9. Crear función para calcular el total de una orden de compra
CREATE OR REPLACE FUNCTION calculate_purchase_order_total(order_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    total DECIMAL(10,2) := 0;
BEGIN
    SELECT COALESCE(SUM(total_price), 0)
    INTO total
    FROM purchase_order_items
    WHERE purchase_order_id = order_id;

    -- Actualizar el total en la orden
    UPDATE purchase_orders
    SET total_amount = total
    WHERE id = order_id;

    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- 10. Crear procedimiento almacenado para calcular estadísticas de clientes
CREATE OR REPLACE FUNCTION get_customer_statistics()
RETURNS TABLE (
    customer_id UUID,
    total_orders BIGINT,
    total_spent DECIMAL(10,2),
    last_order_date TIMESTAMP WITH TIME ZONE,
    customer_type VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as customer_id,
        COUNT(DISTINCT so.id)::BIGINT as total_orders,
        COALESCE(SUM(so.total_amount), 0)::DECIMAL(10,2) as total_spent,
        MAX(so.order_date) as last_order_date,
        CASE
            WHEN COALESCE(SUM(so.total_amount), 0) > 5000 THEN 'vip'
            WHEN COUNT(DISTINCT so.id) > 5 THEN 'regular'
            ELSE 'new'
        END as customer_type
    FROM customers c
    LEFT JOIN sales_orders so ON c.id = so.customer_id AND so.status = 'DELIVERED'
    WHERE c.is_active = true
    GROUP BY c.id
    ORDER BY total_spent DESC, total_orders DESC;
END;
$$ LANGUAGE plpgsql;

-- 11. Crear vista para estadísticas de clientes (alternativa al procedimiento)
CREATE OR REPLACE VIEW customer_statistics_view AS
SELECT
    c.id as customer_id,
    c.name as customer_name,
    c.email as customer_email,
    COUNT(DISTINCT so.id) as total_orders,
    COALESCE(SUM(so.total_amount), 0) as total_spent,
    MAX(so.order_date) as last_order_date,
    CASE
        WHEN COALESCE(SUM(so.total_amount), 0) > 5000 THEN 'vip'
        WHEN COUNT(DISTINCT so.id) > 5 THEN 'regular'
        ELSE 'new'
    END as customer_type
FROM customers c
LEFT JOIN sales_orders so ON c.id = so.customer_id AND so.status = 'DELIVERED'
WHERE c.is_active = true
GROUP BY c.id, c.name, c.email;

-- 12. Insertar algunos datos de prueba
INSERT INTO customers (name, email, phone, is_active) VALUES
('Cliente VIP Ejemplo', 'vip@example.com', '+1234567890', true),
('Cliente Regular Ejemplo', 'regular@example.com', '+0987654321', true),
('Cliente Nuevo Ejemplo', 'nuevo@example.com', '+1122334455', true)
ON CONFLICT DO NOTHING;

-- 13. Crear políticas RLS básicas (descomenta si usas RLS)
-- ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Allow all operations for authenticated users" ON sales_orders FOR ALL TO authenticated USING (true);
-- CREATE POLICY "Allow all operations for authenticated users" ON sales_order_items FOR ALL TO authenticated USING (true);
-- CREATE POLICY "Allow all operations for authenticated users" ON purchase_orders FOR ALL TO authenticated USING (true);
-- CREATE POLICY "Allow all operations for authenticated users" ON purchase_order_items FOR ALL TO authenticated USING (true);

-- Script para poblar datos de prueba en tu sistema de inventario
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Insertar almacenes de prueba
INSERT INTO warehouses (code, name, address, is_active) VALUES 
('ALM001', 'Almacén Principal', 'Av. Principal 123, Ciudad', true),
('ALM002', 'Almacén Secundario', 'Calle Secundaria 456, Ciudad', true),
('ALM003', 'Almacén de Reserva', 'Zona Industrial 789, Ciudad', true)
ON CONFLICT (code) DO NOTHING;

-- 2. Insertar categorías de prueba (si no existen)
INSERT INTO categories (name, description) VALUES 
('Electrónicos', 'Dispositivos electrónicos y tecnología'),
('Ropa', 'Prendas de vestir y accesorios'),
('Hogar', 'Artículos para el hogar y decoración'),
('Oficina', 'Suministros y equipos de oficina'),
('Deportes', 'Artículos deportivos y fitness')
ON CONFLICT (name) DO NOTHING;

-- 3. Insertar proveedores de prueba (si no existen)
INSERT INTO suppliers (name, email, phone, address, is_active) VALUES 
('Tech Solutions SA', 'ventas@techsolutions.com', '+52-555-0001', 'Av. Tecnología 100', true),
('Moda y Estilo', 'contacto@modayestilo.com', '+52-555-0002', 'Calle Moda 200', true),
('Casa y Hogar', 'info@casayhogar.com', '+52-555-0003', 'Blvd. Hogar 300', true),
('Office Pro', 'ventas@officepro.com', '+52-555-0004', 'Av. Oficina 400', true)
ON CONFLICT DO NOTHING;

-- 4. Obtener IDs para usar en los siguientes inserts
-- (Nota: En un entorno real, necesitarías obtener estos IDs primero)

-- 5. Insertar productos de prueba (si no tienes muchos)
-- Primero obtenemos algunos IDs de categorías
DO $$
DECLARE
    cat_electronics_id UUID;
    cat_clothing_id UUID;
    cat_home_id UUID;
    cat_office_id UUID;
    supplier1_id UUID;
    supplier2_id UUID;
    wh1_id UUID;
    wh2_id UUID;
    wh3_id UUID;
    product1_id UUID;
    product2_id UUID;
    product3_id UUID;
    product4_id UUID;
    product5_id UUID;
BEGIN
    -- Obtener IDs de categorías
    SELECT id INTO cat_electronics_id FROM categories WHERE name = 'Electrónicos' LIMIT 1;
    SELECT id INTO cat_clothing_id FROM categories WHERE name = 'Ropa' LIMIT 1;
    SELECT id INTO cat_home_id FROM categories WHERE name = 'Hogar' LIMIT 1;
    SELECT id INTO cat_office_id FROM categories WHERE name = 'Oficina' LIMIT 1;
    
    -- Obtener IDs de proveedores
    SELECT id INTO supplier1_id FROM suppliers WHERE name = 'Tech Solutions SA' LIMIT 1;
    SELECT id INTO supplier2_id FROM suppliers WHERE name = 'Moda y Estilo' LIMIT 1;
    
    -- Obtener IDs de almacenes
    SELECT id INTO wh1_id FROM warehouses WHERE code = 'ALM001' LIMIT 1;
    SELECT id INTO wh2_id FROM warehouses WHERE code = 'ALM002' LIMIT 1;
    SELECT id INTO wh3_id FROM warehouses WHERE code = 'ALM003' LIMIT 1;
    
    -- Insertar productos de prueba
    INSERT INTO products (sku, name, description, category_id, unit, cost, price, min_stock, barcode, is_active) VALUES 
    ('LAPTOP001', 'Laptop Dell Inspiron 15', 'Laptop para uso profesional con 8GB RAM', cat_electronics_id, 'PZ', 800.00, 1200.00, 5, '1234567890123', true),
    ('MOUSE001', 'Mouse Inalámbrico Logitech', 'Mouse ergonómico con batería de larga duración', cat_electronics_id, 'PZ', 15.00, 35.00, 20, '1234567890124', true),
    ('CAMISA001', 'Camisa Formal Azul', 'Camisa de vestir 100% algodón', cat_clothing_id, 'PZ', 25.00, 60.00, 15, '1234567890125', true),
    ('SILLA001', 'Silla Ergonómica de Oficina', 'Silla con soporte lumbar y altura ajustable', cat_office_id, 'PZ', 120.00, 250.00, 8, '1234567890126', true),
    ('LAMPARA001', 'Lámpara de Mesa LED', 'Lámpara con regulador de intensidad', cat_home_id, 'PZ', 30.00, 75.00, 12, '1234567890127', true)
    ON CONFLICT (sku) DO NOTHING
    RETURNING id;
    
    -- Obtener IDs de productos recién insertados (o existentes)
    SELECT id INTO product1_id FROM products WHERE sku = 'LAPTOP001' LIMIT 1;
    SELECT id INTO product2_id FROM products WHERE sku = 'MOUSE001' LIMIT 1;
    SELECT id INTO product3_id FROM products WHERE sku = 'CAMISA001' LIMIT 1;
    SELECT id INTO product4_id FROM products WHERE sku = 'SILLA001' LIMIT 1;
    SELECT id INTO product5_id FROM products WHERE sku = 'LAMPARA001' LIMIT 1;
    
    -- Insertar stock en diferentes almacenes
    INSERT INTO stock (product_id, warehouse_id, qty) VALUES 
    -- Laptop Dell
    (product1_id, wh1_id, 12),
    (product1_id, wh2_id, 8),
    (product1_id, wh3_id, 5),
    
    -- Mouse Logitech
    (product2_id, wh1_id, 45),
    (product2_id, wh2_id, 30),
    (product2_id, wh3_id, 15),
    
    -- Camisa Formal
    (product3_id, wh1_id, 25),
    (product3_id, wh2_id, 18),
    
    -- Silla Ergonómica
    (product4_id, wh1_id, 6),
    (product4_id, wh2_id, 4),
    (product4_id, wh3_id, 2),
    
    -- Lámpara LED
    (product5_id, wh1_id, 20),
    (product5_id, wh2_id, 15),
    (product5_id, wh3_id, 8)
    ON CONFLICT (product_id, warehouse_id) DO UPDATE SET qty = EXCLUDED.qty;
    
END $$;

-- 6. Insertar algunos movimientos de inventario de ejemplo
DO $$
DECLARE
    product_id UUID;
    wh_id UUID;
    user_id UUID;
    reason_id INTEGER;
BEGIN
    -- Obtener un producto y almacén para el ejemplo
    SELECT id INTO product_id FROM products WHERE sku = 'LAPTOP001' LIMIT 1;
    SELECT id INTO wh_id FROM warehouses WHERE code = 'ALM001' LIMIT 1;
    
    -- Obtener un usuario (asumiendo que tienes usuarios en auth.users)
    SELECT id INTO user_id FROM auth.users LIMIT 1;
    
    -- Insertar razones de movimiento si no existen
    INSERT INTO movement_reasons (code, description) VALUES 
    ('PURCHASE', 'Compra de mercancía'),
    ('SALE', 'Venta de producto'),
    ('ADJUSTMENT', 'Ajuste de inventario'),
    ('RETURN', 'Devolución de cliente'),
    ('DAMAGE', 'Producto dañado')
    ON CONFLICT (code) DO NOTHING;
    
    -- Obtener ID de razón
    SELECT id INTO reason_id FROM movement_reasons WHERE code = 'PURCHASE' LIMIT 1;
    
    -- Insertar algunos movimientos de ejemplo
    IF product_id IS NOT NULL AND wh_id IS NOT NULL AND reason_id IS NOT NULL THEN
        INSERT INTO inventory_movements (product_id, warehouse_id, qty, reason_id, note, created_by) VALUES 
        (product_id, wh_id, 10, reason_id, 'Compra inicial de laptops', user_id),
        (product_id, wh_id, -2, reason_id, 'Venta de 2 laptops', user_id);
    END IF;
END $$;

-- 7. Verificar los datos insertados
SELECT 'Resumen de datos creados:' as info;
SELECT 'Almacenes:' as tipo, COUNT(*) as cantidad FROM warehouses WHERE is_active = true;
SELECT 'Categorías:' as tipo, COUNT(*) as cantidad FROM categories;
SELECT 'Proveedores:' as tipo, COUNT(*) as cantidad FROM suppliers WHERE is_active = true;
SELECT 'Productos:' as tipo, COUNT(*) as cantidad FROM products WHERE is_active = true;
SELECT 'Registros de Stock:' as tipo, COUNT(*) as cantidad FROM stock;
SELECT 'Movimientos:' as tipo, COUNT(*) as cantidad FROM inventory_movements;

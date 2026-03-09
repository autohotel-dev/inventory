-- Script para RESET COMPLETO del sistema
-- ⚠️ MÁXIMA PRECAUCIÓN: Esto eliminará TODO y recreará la configuración básica

-- 1. Limpiar todas las tablas
TRUNCATE TABLE inventory_movements RESTART IDENTITY CASCADE;
TRUNCATE TABLE stock RESTART IDENTITY CASCADE;
TRUNCATE TABLE products RESTART IDENTITY CASCADE;
TRUNCATE TABLE customers RESTART IDENTITY CASCADE;
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;
TRUNCATE TABLE suppliers RESTART IDENTITY CASCADE;
TRUNCATE TABLE warehouses RESTART IDENTITY CASCADE;
TRUNCATE TABLE movement_reasons RESTART IDENTITY CASCADE;

-- 2. Recrear categorías básicas
INSERT INTO categories (name, description, is_active) VALUES 
('Electrónicos', 'Productos electrónicos y tecnológicos', true),
('Ropa', 'Prendas de vestir y accesorios', true),
('Hogar', 'Artículos para el hogar y decoración', true),
('Deportes', 'Equipamiento y ropa deportiva', true),
('Libros', 'Libros y material educativo', true),
('Salud', 'Productos de salud y cuidado personal', true);

-- 3. Recrear almacenes básicos
INSERT INTO warehouses (name, code, address, is_active) VALUES 
('Almacén Principal', 'ALM-001', 'Av. Principal 123, Ciudad', true),
('Almacén Secundario', 'ALM-002', 'Calle Secundaria 456, Ciudad', true),
('Tienda Centro', 'TDA-001', 'Centro Comercial Plaza, Local 15', true);

-- 4. Recrear proveedores básicos
INSERT INTO suppliers (name, email, phone, address, is_active) VALUES 
('Proveedor Tecnología SA', 'ventas@tecno.com', '+52 555 1234', 'Zona Industrial Norte', true),
('Distribuidora Textil', 'contacto@textil.com', '+52 555 5678', 'Distrito Textil 789', true),
('Importadora Global', 'info@global.com', '+52 555 9012', 'Puerto Comercial 321', true);

-- 5. Recrear razones de movimiento (si no existen)
INSERT INTO movement_reasons (code, name, description, movement_type, is_active) VALUES 
-- Entradas
('PURCHASE', 'Compra', 'Compra de mercancía a proveedor', 'IN', true),
('CUSTOMER_RETURN', 'Devolución de cliente', 'Cliente devuelve producto', 'IN', true),
('PRODUCTION', 'Producción', 'Producto terminado de producción interna', 'IN', true),
('TRANSFER_IN', 'Transferencia entrada', 'Transferencia desde otro almacén', 'IN', true),

-- Salidas
('SALE', 'Venta', 'Venta a cliente', 'OUT', true),
('SUPPLIER_RETURN', 'Devolución a proveedor', 'Devolución de mercancía defectuosa', 'OUT', true),
('DAMAGED', 'Producto dañado', 'Producto dañado o vencido', 'OUT', true),
('TRANSFER_OUT', 'Transferencia salida', 'Transferencia a otro almacén', 'OUT', true),
('INTERNAL_USE', 'Uso interno', 'Consumo interno de la empresa', 'OUT', true),

-- Ajustes
('PHYSICAL_COUNT', 'Conteo físico', 'Ajuste por inventario físico', 'ADJUSTMENT', true),
('ERROR_CORRECTION', 'Corrección de error', 'Corrección de error de captura', 'ADJUSTMENT', true),
('INITIAL_LOAD', 'Ajuste inicial', 'Carga inicial de inventario', 'ADJUSTMENT', true);

-- 6. Mostrar resumen de configuración creada
SELECT 'CONFIGURACIÓN BÁSICA CREADA:' as info;

SELECT 'categories' as tabla, COUNT(*) as registros FROM categories
UNION ALL SELECT 'suppliers' as tabla, COUNT(*) as registros FROM suppliers
UNION ALL SELECT 'warehouses' as tabla, COUNT(*) as registros FROM warehouses
UNION ALL SELECT 'movement_reasons' as tabla, COUNT(*) as registros FROM movement_reasons;

SELECT '🎉 Sistema completamente reseteado con configuración básica.' as resultado;
SELECT '📋 Puedes empezar a agregar productos, clientes y registrar movimientos.' as siguiente_paso;

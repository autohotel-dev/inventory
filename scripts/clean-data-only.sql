-- Script para limpiar SOLO los datos, manteniendo categorías, almacenes, proveedores y razones
-- Este script es más seguro si quieres mantener la configuración básica

-- Mostrar conteo antes
SELECT 'ANTES - Conteo de registros:' as info;
SELECT 'products' as tabla, COUNT(*) as registros FROM products
UNION ALL SELECT 'customers' as tabla, COUNT(*) as registros FROM customers
UNION ALL SELECT 'stock' as tabla, COUNT(*) as registros FROM stock
UNION ALL SELECT 'inventory_movements' as tabla, COUNT(*) as registros FROM inventory_movements;

-- Limpiar solo datos operacionales
TRUNCATE TABLE inventory_movements RESTART IDENTITY CASCADE;
TRUNCATE TABLE stock RESTART IDENTITY CASCADE;
TRUNCATE TABLE products RESTART IDENTITY CASCADE;
TRUNCATE TABLE customers RESTART IDENTITY CASCADE;

-- Mostrar conteo después
SELECT 'DESPUÉS - Conteo de registros:' as info;
SELECT 'products' as tabla, COUNT(*) as registros FROM products
UNION ALL SELECT 'customers' as tabla, COUNT(*) as registros FROM customers
UNION ALL SELECT 'stock' as tabla, COUNT(*) as registros FROM stock
UNION ALL SELECT 'inventory_movements' as tabla, COUNT(*) as registros FROM inventory_movements;

-- Mostrar configuración que se mantiene
SELECT 'CONFIGURACIÓN MANTENIDA:' as info;
SELECT 'categories' as tabla, COUNT(*) as registros FROM categories
UNION ALL SELECT 'suppliers' as tabla, COUNT(*) as registros FROM suppliers
UNION ALL SELECT 'warehouses' as tabla, COUNT(*) as registros FROM warehouses
UNION ALL SELECT 'movement_reasons' as tabla, COUNT(*) as registros FROM movement_reasons;

SELECT '✅ Limpieza de datos completada. Configuración básica mantenida.' as resultado;

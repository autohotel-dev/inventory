-- Script para limpiar todas las tablas del sistema de inventario
-- ⚠️ ADVERTENCIA: Este script eliminará TODOS los datos de las tablas
-- Úsalo solo si quieres empezar con datos limpios

-- Mostrar información antes de limpiar
SELECT 'ANTES DE LIMPIAR - Conteo de registros:' as info;

SELECT 
  'products' as tabla, 
  COUNT(*) as registros 
FROM products
UNION ALL
SELECT 
  'categories' as tabla, 
  COUNT(*) as registros 
FROM categories
UNION ALL
SELECT 
  'suppliers' as tabla, 
  COUNT(*) as registros 
FROM suppliers
UNION ALL
SELECT 
  'warehouses' as tabla, 
  COUNT(*) as registros 
FROM warehouses
UNION ALL
SELECT 
  'customers' as tabla, 
  COUNT(*) as registros 
FROM customers
UNION ALL
SELECT 
  'stock' as tabla, 
  COUNT(*) as registros 
FROM stock
UNION ALL
SELECT 
  'inventory_movements' as tabla, 
  COUNT(*) as registros 
FROM inventory_movements
UNION ALL
SELECT 
  'movement_reasons' as tabla, 
  COUNT(*) as registros 
FROM movement_reasons;

-- Limpiar tablas en el orden correcto (respetando foreign keys)
-- 1. Primero las tablas dependientes
TRUNCATE TABLE inventory_movements RESTART IDENTITY CASCADE;
TRUNCATE TABLE stock RESTART IDENTITY CASCADE;

-- 2. Luego las tablas principales
TRUNCATE TABLE products RESTART IDENTITY CASCADE;
TRUNCATE TABLE customers RESTART IDENTITY CASCADE;

-- 3. Tablas de configuración (opcional - descomenta si quieres limpiarlas también)
-- TRUNCATE TABLE categories RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE suppliers RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE warehouses RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE movement_reasons RESTART IDENTITY CASCADE;

-- Mostrar información después de limpiar
SELECT 'DESPUÉS DE LIMPIAR - Conteo de registros:' as info;

SELECT 
  'products' as tabla, 
  COUNT(*) as registros 
FROM products
UNION ALL
SELECT 
  'categories' as tabla, 
  COUNT(*) as registros 
FROM categories
UNION ALL
SELECT 
  'suppliers' as tabla, 
  COUNT(*) as registros 
FROM suppliers
UNION ALL
SELECT 
  'warehouses' as tabla, 
  COUNT(*) as registros 
FROM warehouses
UNION ALL
SELECT 
  'customers' as tabla, 
  COUNT(*) as registros 
FROM customers
UNION ALL
SELECT 
  'stock' as tabla, 
  COUNT(*) as registros 
FROM stock
UNION ALL
SELECT 
  'inventory_movements' as tabla, 
  COUNT(*) as registros 
FROM inventory_movements
UNION ALL
SELECT 
  'movement_reasons' as tabla, 
  COUNT(*) as registros 
FROM movement_reasons;

SELECT '✅ Limpieza completada. Las tablas principales están vacías.' as resultado;

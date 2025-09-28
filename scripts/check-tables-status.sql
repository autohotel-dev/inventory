-- Script para verificar el estado actual de todas las tablas
-- Ejecuta este script para ver qué datos tienes antes de limpiar

SELECT '📊 ESTADO ACTUAL DE LAS TABLAS' as titulo;

-- Conteo de registros por tabla
SELECT 
  'products' as tabla, 
  COUNT(*) as total_registros,
  COUNT(CASE WHEN is_active = true THEN 1 END) as activos,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactivos
FROM products
UNION ALL
SELECT 
  'categories' as tabla, 
  COUNT(*) as total_registros,
  COUNT(CASE WHEN is_active = true THEN 1 END) as activos,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactivos
FROM categories
UNION ALL
SELECT 
  'suppliers' as tabla, 
  COUNT(*) as total_registros,
  COUNT(CASE WHEN is_active = true THEN 1 END) as activos,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactivos
FROM suppliers
UNION ALL
SELECT 
  'warehouses' as tabla, 
  COUNT(*) as total_registros,
  COUNT(CASE WHEN is_active = true THEN 1 END) as activos,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactivos
FROM warehouses
UNION ALL
SELECT 
  'customers' as tabla, 
  COUNT(*) as total_registros,
  COUNT(CASE WHEN is_active = true THEN 1 END) as activos,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactivos
FROM customers;

-- Tablas sin campo is_active
SELECT 'stock' as tabla, COUNT(*) as total_registros, 0 as activos, 0 as inactivos FROM stock
UNION ALL
SELECT 'inventory_movements' as tabla, COUNT(*) as total_registros, 0 as activos, 0 as inactivos FROM inventory_movements
UNION ALL
SELECT 'movement_reasons' as tabla, COUNT(*) as total_registros, 
  COUNT(CASE WHEN is_active = true THEN 1 END) as activos,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactivos
FROM movement_reasons;

-- Información detallada de stock
SELECT '📦 RESUMEN DE STOCK' as titulo;
SELECT 
  COUNT(DISTINCT product_id) as productos_con_stock,
  COUNT(DISTINCT warehouse_id) as almacenes_con_stock,
  SUM(qty) as stock_total_unidades
FROM stock 
WHERE qty > 0;

-- Información de movimientos
SELECT '📋 RESUMEN DE MOVIMIENTOS' as titulo;
SELECT 
  movement_type,
  COUNT(*) as cantidad_movimientos,
  SUM(quantity) as cantidad_total
FROM inventory_movements 
GROUP BY movement_type
ORDER BY movement_type;

-- Últimos movimientos
SELECT '🕐 ÚLTIMOS 5 MOVIMIENTOS' as titulo;
SELECT 
  created_at,
  movement_type,
  quantity,
  reason
FROM inventory_movements 
ORDER BY created_at DESC 
LIMIT 5;

-- Script para verificar la estructura de la tabla sales_orders
-- Ejecutar en Supabase SQL Editor

-- Verificar estructura de la tabla sales_orders
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'sales_orders' 
ORDER BY ordinal_position;

-- Verificar estructura de la tabla purchase_orders para comparar
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'purchase_orders' 
ORDER BY ordinal_position;

-- Script para verificar el estado actual de las funciones y vistas
-- Ejecuta este script en Supabase para diagnosticar problemas

-- 1. Verificar si existe la función get_customer_statistics
SELECT
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    p.prokind as kind
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'get_customer_statistics';

-- 2. Verificar si existe la vista customer_statistics_view
SELECT
    schemaname,
    viewname,
    viewowner,
    definition
FROM pg_views
WHERE viewname = 'customer_statistics_view';

-- 3. Probar ejecutar la función directamente
SELECT * FROM get_customer_statistics();

-- 4. Probar consultar la vista directamente
SELECT * FROM customer_statistics_view;

-- 5. Verificar estructura de la tabla sales_orders
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_orders'
ORDER BY ordinal_position;

-- 6. Verificar que hay datos en las tablas
SELECT
    'customers' as tabla,
    COUNT(*) as registros
FROM customers
UNION ALL
SELECT
    'sales_orders' as tabla,
    COUNT(*) as registros
FROM sales_orders
UNION ALL
SELECT
    'customer_statistics_view' as tabla,
    COUNT(*) as registros
FROM customer_statistics_view;

-- ================================================================
-- DIAGNÓSTICO Y FIX: Supabase Realtime
-- Ejecutar este script en el SQL Editor de Supabase
-- ================================================================

-- 1. DIAGNÓSTICO: Verificar qué tablas están en la publicación
SELECT 
    pubname as publication_name,
    schemaname as schema,
    tablename as table_name
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- 2. DIAGNÓSTICO: Verificar políticas RLS en tablas críticas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('rooms', 'room_stays', 'payments', 'sensors', 'messages');

-- 3. DIAGNÓSTICO: Verificar si RLS está habilitado
SELECT 
    relname as table_name,
    relrowsecurity as rls_enabled,
    relforcerowsecurity as rls_forced
FROM pg_class
WHERE relname IN ('rooms', 'room_stays', 'payments', 'sensors', 'messages');

-- ================================================================
-- FIX: Aplicar si las tablas no están en la publicación
-- ================================================================

-- 4. Habilitar RLS en todas las tablas críticas
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensors ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas de lectura para usuarios autenticados
-- ROOMS
DROP POLICY IF EXISTS "Allow authenticated read rooms" ON rooms;
CREATE POLICY "Allow authenticated read rooms" ON rooms 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- ROOM_STAYS
DROP POLICY IF EXISTS "Allow authenticated read room_stays" ON room_stays;
CREATE POLICY "Allow authenticated read room_stays" ON room_stays 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- PAYMENTS
DROP POLICY IF EXISTS "Allow authenticated read payments" ON payments;
CREATE POLICY "Allow authenticated read payments" ON payments 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- SENSORS
DROP POLICY IF EXISTS "Allow authenticated read sensors" ON sensors;
CREATE POLICY "Allow authenticated read sensors" ON sensors 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- SALES_ORDERS
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read sales_orders" ON sales_orders;
CREATE POLICY "Allow authenticated read sales_orders" ON sales_orders 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- 6. Agregar tablas a la publicación de Realtime
-- Usar SET para evitar errores si ya existen
ALTER PUBLICATION supabase_realtime SET TABLE 
    rooms, 
    room_stays, 
    payments, 
    sensors,
    notifications,
    messages,
    sales_orders;

-- 7. Verificar el resultado
SELECT 'Tablas en supabase_realtime:' as info;
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

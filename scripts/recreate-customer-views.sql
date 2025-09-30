-- Script para corregir completamente la vista customer_statistics_view
-- Ejecuta este script en Supabase

-- 1. Eliminar vista existente si existe
DROP VIEW IF EXISTS customer_statistics_view;

-- 2. Crear función corregida
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
        c.id::UUID,
        COUNT(DISTINCT so.id)::BIGINT,
        COALESCE(SUM(so.total), 0)::DECIMAL(18,6),
        MAX(so.created_at)::TIMESTAMP WITH TIME ZONE,
        CASE
            WHEN COALESCE(SUM(so.total), 0) > 5000 THEN 'vip'::VARCHAR(20)
            WHEN COUNT(DISTINCT so.id) > 5 THEN 'regular'::VARCHAR(20)
            ELSE 'new'::VARCHAR(20)
        END::VARCHAR(20)
    FROM customers c
    LEFT JOIN sales_orders so ON c.id = so.customer_id
        AND so.status NOT IN ('CANCELLED')
        AND so.total > 0
    WHERE c.is_active = true
    GROUP BY c.id
    ORDER BY COALESCE(SUM(so.total), 0) DESC, COUNT(DISTINCT so.id) DESC;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear vista nueva con nombres correctos
CREATE VIEW customer_statistics_view AS
SELECT
    c.id as customer_id,
    c.name as customer_name,
    c.email as customer_email,
    COUNT(DISTINCT so.id)::BIGINT as total_orders,
    COALESCE(SUM(so.total), 0)::DECIMAL(18,6) as total_spent,
    COALESCE(SUM(so.subtotal), 0)::DECIMAL(18,6) as subtotal,
    COALESCE(SUM(so.tax), 0)::DECIMAL(18,6) as total_tax,
    MAX(so.created_at) as last_order_date,
    so.currency as order_currency,
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

-- 4. Probar que todo funciona
SELECT
    '✅ Función corregida' as funcion_status,
    (SELECT COUNT(*) FROM get_customer_statistics()) as registros_funcion;

SELECT
    '✅ Vista creada' as vista_status,
    (SELECT COUNT(*) FROM customer_statistics_view) as registros_vista;

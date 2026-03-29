-- Script simplificado para corregir solo la función get_customer_statistics
-- Ejecuta este script en Supabase para solucionar el error de tipos

-- Corregir función con tipos explícitos
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

-- Recrear vista con tipos correctos
CREATE OR REPLACE VIEW customer_statistics_view AS
SELECT
    c.id::UUID,
    c.name::TEXT,
    c.email::TEXT,
    COUNT(DISTINCT so.id)::BIGINT,
    COALESCE(SUM(so.total), 0)::DECIMAL(18,6),
    COALESCE(SUM(so.subtotal), 0)::DECIMAL(18,6),
    COALESCE(SUM(so.tax), 0)::DECIMAL(18,6),
    MAX(so.created_at)::TIMESTAMP WITH TIME ZONE,
    so.currency::TEXT,
    CASE
        WHEN COALESCE(SUM(so.total), 0) > 5000 THEN 'vip'::VARCHAR(20)
        WHEN COUNT(DISTINCT so.id) > 5 THEN 'regular'::VARCHAR(20)
        ELSE 'new'::VARCHAR(20)
    END::VARCHAR(20) as customer_type
FROM customers c
LEFT JOIN sales_orders so ON c.id = so.customer_id
    AND so.status NOT IN ('CANCELLED')
    AND so.total > 0
WHERE c.is_active = true
GROUP BY c.id, c.name, c.email, so.currency;

-- Probar que funciona
SELECT '✅ Función corregida exitosamente' as resultado;

-- Script para crear trigger que actualice la tabla stock automáticamente
-- cuando se insertan movimientos en inventory_movements

-- ==============================================================================
-- FUNCIÓN: Actualizar stock cuando hay movimientos
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_stock_from_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar o insertar en la tabla stock
    INSERT INTO stock (product_id, warehouse_id, qty)
    VALUES (
        NEW.product_id,
        NEW.warehouse_id,
        CASE 
            WHEN NEW.movement_type = 'IN' THEN NEW.quantity
            WHEN NEW.movement_type = 'OUT' THEN -NEW.quantity
            ELSE 0
        END
    )
    ON CONFLICT (product_id, warehouse_id) 
    DO UPDATE SET
        qty = stock.qty + CASE 
            WHEN NEW.movement_type = 'IN' THEN NEW.quantity
            WHEN NEW.movement_type = 'OUT' THEN -NEW.quantity
            ELSE 0
        END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- TRIGGER: Ejecutar función después de INSERT en inventory_movements
-- ==============================================================================

DROP TRIGGER IF EXISTS trigger_update_stock_after_movement ON inventory_movements;

CREATE TRIGGER trigger_update_stock_after_movement
    AFTER INSERT ON inventory_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_from_movement();

-- ==============================================================================
-- SINCRONIZACIÓN INICIAL: Recalcular stock desde cero basándose en movimientos
-- ==============================================================================

-- ADVERTENCIA: Esto borrará los datos actuales de stock y los recalculará
-- Solo ejecuta esto si quieres sincronizar el stock con los movimientos existentes

-- Comentar/descomentar según necesites:
-- TRUNCATE TABLE stock;

-- Insertar stock calculado desde inventory_movements
INSERT INTO stock (product_id, warehouse_id, qty)
SELECT 
    product_id,
    warehouse_id,
    SUM(
        CASE 
            WHEN movement_type = 'IN' THEN quantity
            WHEN movement_type = 'OUT' THEN -quantity
            ELSE 0
        END
    ) as qty
FROM inventory_movements
GROUP BY product_id, warehouse_id
HAVING SUM(
    CASE 
        WHEN movement_type = 'IN' THEN quantity
        WHEN movement_type = 'OUT' THEN -quantity
        ELSE 0
    END
) > 0  -- Solo insertar si hay stock positivo
ON CONFLICT (product_id, warehouse_id) 
DO UPDATE SET qty = EXCLUDED.qty;

-- ==============================================================================
-- VERIFICACIONES
-- ==============================================================================

-- Ver la función creada
SELECT 
    proname as function_name, 
    prosrc as source_code
FROM pg_proc 
WHERE proname = 'update_stock_from_movement';

-- Ver el trigger creado
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_stock_after_movement';

-- Comparar stock vs movimientos (para verificar sincronización)
WITH stock_from_movements AS (
    SELECT 
        product_id,
        warehouse_id,
        SUM(
            CASE 
                WHEN movement_type = 'IN' THEN quantity
                WHEN movement_type = 'OUT' THEN -quantity
                ELSE 0
            END
        ) as calculated_qty
    FROM inventory_movements
    GROUP BY product_id, warehouse_id
)
SELECT 
    p.sku,
    p.name as product_name,
    w.code as warehouse_code,
    s.qty as current_stock,
    COALESCE(sfm.calculated_qty, 0) as calculated_from_movements,
    s.qty - COALESCE(sfm.calculated_qty, 0) as difference
FROM stock s
JOIN products p ON p.id = s.product_id
JOIN warehouses w ON w.id = s.warehouse_id
LEFT JOIN stock_from_movements sfm ON sfm.product_id = s.product_id 
    AND sfm.warehouse_id = s.warehouse_id
WHERE s.qty != COALESCE(sfm.calculated_qty, 0)
ORDER BY ABS(s.qty - COALESCE(sfm.calculated_qty, 0)) DESC;

-- ==============================================================================
-- PRUEBA DEL TRIGGER
-- ==============================================================================

-- Para probar que funciona, puedes ejecutar esto (SOLO EN DESARROLLO):
/*
-- 1. Ver stock actual de un producto
SELECT * FROM stock WHERE product_id = 'TU_PRODUCT_ID_AQUI' LIMIT 1;

-- 2. Insertar un movimiento de prueba
INSERT INTO inventory_movements (
    product_id, 
    warehouse_id, 
    quantity, 
    movement_type, 
    reason_id
) VALUES (
    'TU_PRODUCT_ID_AQUI',
    'TU_WAREHOUSE_ID_AQUI',
    10,
    'IN',
    1
);

-- 3. Verificar que el stock se actualizó automáticamente
SELECT * FROM stock WHERE product_id = 'TU_PRODUCT_ID_AQUI' LIMIT 1;
*/

SELECT 'Trigger de stock creado exitosamente' as status;

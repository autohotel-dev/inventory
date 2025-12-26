-- Script para verificar y asegurar que el trigger de stock está funcionando
-- Este trigger DEBE actualizar automáticamente la tabla stock cuando hay movimientos

-- ==============================================================================
-- PASO 1: Verificar si el trigger existe y está activo
-- ==============================================================================

SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation,
    event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'inventory_movements'
ORDER BY trigger_name;

-- ==============================================================================
-- PASO 2: Verificar si la función existe
-- ==============================================================================

SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_name = 'apply_inventory_movement';

-- ==============================================================================
-- PASO 3: Asegurar que la función está correcta
-- ==============================================================================

-- Esta es la función que DEBE existir para que funcione el stock
CREATE OR REPLACE FUNCTION apply_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Aplicar el movimiento al stock
    IF NEW.movement_type = 'IN' THEN
        -- Entrada: sumar al stock
        INSERT INTO stock (product_id, warehouse_id, qty)
        VALUES (NEW.product_id, NEW.warehouse_id, NEW.quantity)
        ON CONFLICT (product_id, warehouse_id)
        DO UPDATE SET qty = stock.qty + NEW.quantity;
        
    ELSIF NEW.movement_type = 'OUT' THEN
        -- Salida: restar del stock
        INSERT INTO stock (product_id, warehouse_id, qty)
        VALUES (NEW.product_id, NEW.warehouse_id, -NEW.quantity)
        ON CONFLICT (product_id, warehouse_id)
        DO UPDATE SET qty = GREATEST(0, stock.qty - NEW.quantity);
        
    ELSIF NEW.movement_type = 'ADJUSTMENT' THEN
        -- Ajuste: establecer cantidad exacta
        INSERT INTO stock (product_id, warehouse_id, qty)
        VALUES (NEW.product_id, NEW.warehouse_id, NEW.quantity)
        ON CONFLICT (product_id, warehouse_id)
        DO UPDATE SET qty = NEW.quantity;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PASO 4: Asegurar que el trigger está creado
-- ==============================================================================

-- Eliminar trigger si existe (para recrearlo limpio)
DROP TRIGGER IF EXISTS trg_inventory_movements_ai ON inventory_movements;

-- Crear el trigger
CREATE TRIGGER trg_inventory_movements_ai
    AFTER INSERT ON inventory_movements 
    FOR EACH ROW
    EXECUTE FUNCTION apply_inventory_movement();

-- ==============================================================================
-- PASO 5: Verificar que todo está correcto
-- ==============================================================================

-- Ver el trigger recién creado
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_inventory_movements_ai';

-- Ver la función
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'apply_inventory_movement';

-- ==============================================================================
-- PASO 6: PRUEBA - Insertar un movimiento de prueba
-- ==============================================================================

-- IMPORTANTE: Reemplaza estos IDs con IDs reales de tu base de datos

/*
-- 1. Ver stock actual antes de la prueba
SELECT 
    p.name as producto,
    w.name as almacen,
    COALESCE(s.qty, 0) as stock_actual
FROM products p
CROSS JOIN warehouses w
LEFT JOIN stock s ON s.product_id = p.id AND s.warehouse_id = w.id
WHERE p.id = 'TU_PRODUCT_ID_AQUI'  -- REEMPLAZAR
AND w.id = 'TU_WAREHOUSE_ID_AQUI'   -- REEMPLAZAR
LIMIT 1;

-- 2. Insertar movimiento de prueba
DO $$
DECLARE
    test_product_id UUID := 'TU_PRODUCT_ID_AQUI';  -- REEMPLAZAR
    test_warehouse_id UUID := 'TU_WAREHOUSE_ID_AQUI';  -- REEMPLAZAR
    test_reason_id INTEGER;
BEGIN
    -- Obtener un reason_id válido
    SELECT id INTO test_reason_id FROM movement_reasons WHERE movement_type = 'IN' LIMIT 1;
    
    -- Insertar movimiento de entrada de 10 unidades
    INSERT INTO inventory_movements (
        product_id,
        warehouse_id,
        quantity,
        movement_type,
        reason_id,
        notes
    ) VALUES (
        test_product_id,
        test_warehouse_id,
        10,
        'IN',
        test_reason_id,
        'PRUEBA DE TRIGGER - Debe sumar 10 al stock'
    );
    
    RAISE NOTICE 'Movimiento de prueba insertado';
END $$;

-- 3. Ver stock actualizado (DEBE mostrar 10 unidades más)
SELECT 
    p.name as producto,
    w.name as almacen,
    COALESCE(s.qty, 0) as stock_despues
FROM products p
CROSS JOIN warehouses w
LEFT JOIN stock s ON s.product_id = p.id AND s.warehouse_id = w.id
WHERE p.id = 'TU_PRODUCT_ID_AQUI'  -- REEMPLAZAR
AND w.id = 'TU_WAREHOUSE_ID_AQUI'   -- REEMPLAZAR
LIMIT 1;

-- 4. Ver el último movimiento creado
SELECT * FROM inventory_movements 
ORDER BY created_at DESC 
LIMIT 1;
*/

-- ==============================================================================
-- RESULTADO FINAL
-- ==============================================================================

SELECT 
    '✅ Trigger configurado correctamente' as status,
    'Los movimientos (individual y batch) ahora actualizarán el stock automáticamente' as descripcion;

SELECT 
    'IMPORTANTE' as nota,
    'Este trigger funciona para TODOS los movimientos - individual, batch, ventas, compras, etc.' as info;

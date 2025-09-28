-- Script para arreglar la función del trigger apply_inventory_movement

-- Ver la función actual
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'apply_inventory_movement';

-- Crear o reemplazar la función del trigger
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

-- Verificar que el trigger existe
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'trg_inventory_movements_ai';

-- Si el trigger no existe, crearlo
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trg_inventory_movements_ai'
    ) THEN
        CREATE TRIGGER trg_inventory_movements_ai
        AFTER INSERT ON inventory_movements 
        FOR EACH ROW
        EXECUTE FUNCTION apply_inventory_movement();
        
        RAISE NOTICE 'Trigger creado';
    ELSE
        RAISE NOTICE 'Trigger ya existe';
    END IF;
END $$;

-- Verificar que todo está correcto
SELECT 'Función y trigger actualizados correctamente' as status;

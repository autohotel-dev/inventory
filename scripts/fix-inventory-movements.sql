-- Script para arreglar la tabla inventory_movements existente

-- Primero, ver la estructura actual
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'inventory_movements' 
ORDER BY ordinal_position;

-- Ver algunos registros existentes
SELECT COUNT(*) as total_records FROM inventory_movements;

-- Arreglar la tabla paso a paso
DO $$ 
BEGIN
    -- Si existe la columna 'qty' pero no 'quantity', renombrarla
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'qty'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'quantity'
    ) THEN
        ALTER TABLE inventory_movements 
        RENAME COLUMN qty TO quantity;
        
        RAISE NOTICE 'Columna qty renombrada a quantity';
    END IF;

    -- Asegurar que quantity tenga valores válidos
    UPDATE inventory_movements 
    SET quantity = 1 
    WHERE quantity IS NULL OR quantity <= 0;
    
    RAISE NOTICE 'Valores nulos o negativos en quantity corregidos';

    -- Agregar movement_type si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'movement_type'
    ) THEN
        ALTER TABLE inventory_movements 
        ADD COLUMN movement_type TEXT DEFAULT 'ADJUSTMENT';
        
        -- Actualizar todos los registros existentes
        UPDATE inventory_movements 
        SET movement_type = 'ADJUSTMENT' 
        WHERE movement_type IS NULL;
        
        -- Hacer la columna NOT NULL después de actualizar
        ALTER TABLE inventory_movements 
        ALTER COLUMN movement_type SET NOT NULL;
        
        -- Agregar constraint
        ALTER TABLE inventory_movements 
        ADD CONSTRAINT check_movement_type 
        CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT'));
        
        RAISE NOTICE 'Columna movement_type agregada con valor por defecto ADJUSTMENT';
    ELSE
        -- Si ya existe, asegurar que no tenga valores nulos
        UPDATE inventory_movements 
        SET movement_type = 'ADJUSTMENT' 
        WHERE movement_type IS NULL;
        
        RAISE NOTICE 'Valores nulos en movement_type corregidos';
    END IF;

    -- Agregar reason si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'reason'
    ) THEN
        ALTER TABLE inventory_movements 
        ADD COLUMN reason TEXT DEFAULT 'Movimiento histórico';
        
        -- Actualizar registros existentes
        UPDATE inventory_movements 
        SET reason = 'Movimiento histórico' 
        WHERE reason IS NULL OR reason = '';
        
        -- Hacer la columna NOT NULL
        ALTER TABLE inventory_movements 
        ALTER COLUMN reason SET NOT NULL;
        
        RAISE NOTICE 'Columna reason agregada';
    ELSE
        -- Si ya existe, asegurar que no tenga valores nulos
        UPDATE inventory_movements 
        SET reason = 'Movimiento histórico' 
        WHERE reason IS NULL OR reason = '';
        
        RAISE NOTICE 'Valores nulos en reason corregidos';
    END IF;

    -- Agregar notes si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE inventory_movements 
        ADD COLUMN notes TEXT;
        
        RAISE NOTICE 'Columna notes agregada';
    END IF;

    -- Agregar created_by si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE inventory_movements 
        ADD COLUMN created_by UUID REFERENCES auth.users(id);
        
        RAISE NOTICE 'Columna created_by agregada';
    END IF;

    -- Verificar y corregir product_id si es necesario
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'product_id'
        AND is_nullable = 'YES'
    ) THEN
        -- Si hay registros con product_id nulo, necesitamos manejarlos
        IF EXISTS (SELECT 1 FROM inventory_movements WHERE product_id IS NULL) THEN
            -- Opción 1: Eliminar registros con product_id nulo
            DELETE FROM inventory_movements WHERE product_id IS NULL;
            RAISE NOTICE 'Registros con product_id nulo eliminados';
            
            -- Opción 2: O asignar un producto por defecto (comentado)
            -- UPDATE inventory_movements 
            -- SET product_id = (SELECT id FROM products LIMIT 1)
            -- WHERE product_id IS NULL;
        END IF;
    END IF;

    -- Lo mismo para warehouse_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'warehouse_id'
        AND is_nullable = 'YES'
    ) THEN
        IF EXISTS (SELECT 1 FROM inventory_movements WHERE warehouse_id IS NULL) THEN
            DELETE FROM inventory_movements WHERE warehouse_id IS NULL;
            RAISE NOTICE 'Registros con warehouse_id nulo eliminados';
        END IF;
    END IF;

END $$;

-- Crear índices que faltan (si no existen)
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse_id ON inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);

-- Habilitar RLS si no está habilitado
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'inventory_movements' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS habilitado en inventory_movements';
    END IF;
END $$;

-- Crear política si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'inventory_movements' 
        AND policyname = 'Allow all operations on inventory_movements'
    ) THEN
        CREATE POLICY "Allow all operations on inventory_movements" 
        ON inventory_movements FOR ALL 
        TO authenticated 
        USING (true) 
        WITH CHECK (true);
        
        RAISE NOTICE 'Política creada para inventory_movements';
    END IF;
END $$;

-- Verificar la estructura final
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'inventory_movements' 
ORDER BY ordinal_position;

-- Mostrar estadísticas finales
SELECT COUNT(*) as total_movements FROM inventory_movements;
SELECT movement_type, COUNT(*) as count 
FROM inventory_movements 
GROUP BY movement_type;

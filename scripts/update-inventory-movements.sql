-- Script para actualizar la tabla inventory_movements existente

-- Primero, verificar la estructura actual
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'inventory_movements' 
ORDER BY ordinal_position;

-- Agregar columnas que faltan (si no existen)
DO $$ 
BEGIN
    -- Agregar product_id si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'product_id'
    ) THEN
        ALTER TABLE inventory_movements 
        ADD COLUMN product_id UUID REFERENCES products(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Columna product_id agregada';
    ELSE
        RAISE NOTICE 'La columna product_id ya existe';
    END IF;

    -- Agregar warehouse_id si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'warehouse_id'
    ) THEN
        ALTER TABLE inventory_movements 
        ADD COLUMN warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Columna warehouse_id agregada';
    ELSE
        RAISE NOTICE 'La columna warehouse_id ya existe';
    END IF;
    -- Agregar quantity si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'quantity'
    ) THEN
        ALTER TABLE inventory_movements 
        ADD COLUMN quantity INTEGER;
        
        -- Actualizar registros existentes con un valor por defecto
        UPDATE inventory_movements 
        SET quantity = 1 
        WHERE quantity IS NULL;
        
        -- Agregar constraint
        ALTER TABLE inventory_movements 
        ADD CONSTRAINT check_quantity_positive 
        CHECK (quantity > 0);
        
        -- Hacer la columna NOT NULL
        ALTER TABLE inventory_movements 
        ALTER COLUMN quantity SET NOT NULL;
        
        RAISE NOTICE 'Columna quantity agregada';
    ELSE
        RAISE NOTICE 'La columna quantity ya existe';
    END IF;

    -- Agregar movement_type si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'movement_type'
    ) THEN
        ALTER TABLE inventory_movements 
        ADD COLUMN movement_type TEXT;
        
        -- Actualizar registros existentes con un valor por defecto
        UPDATE inventory_movements 
        SET movement_type = 'ADJUSTMENT' 
        WHERE movement_type IS NULL;
        
        -- Agregar constraint
        ALTER TABLE inventory_movements 
        ADD CONSTRAINT check_movement_type 
        CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT'));
        
        -- Hacer la columna NOT NULL
        ALTER TABLE inventory_movements 
        ALTER COLUMN movement_type SET NOT NULL;
        
        RAISE NOTICE 'Columna movement_type agregada';
    ELSE
        RAISE NOTICE 'La columna movement_type ya existe';
    END IF;

    -- Agregar reason si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'reason'
    ) THEN
        ALTER TABLE inventory_movements 
        ADD COLUMN reason TEXT;
        
        -- Actualizar registros existentes
        UPDATE inventory_movements 
        SET reason = 'Movimiento histórico' 
        WHERE reason IS NULL;
        
        -- Hacer la columna NOT NULL
        ALTER TABLE inventory_movements 
        ALTER COLUMN reason SET NOT NULL;
        
        RAISE NOTICE 'Columna reason agregada';
    ELSE
        RAISE NOTICE 'La columna reason ya existe';
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
    ELSE
        RAISE NOTICE 'La columna notes ya existe';
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
    ELSE
        RAISE NOTICE 'La columna created_by ya existe';
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
    ELSE
        RAISE NOTICE 'RLS ya está habilitado en inventory_movements';
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
    ELSE
        RAISE NOTICE 'La política ya existe para inventory_movements';
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

-- Mostrar algunos registros de ejemplo
SELECT COUNT(*) as total_movements FROM inventory_movements;
SELECT movement_type, COUNT(*) as count 
FROM inventory_movements 
GROUP BY movement_type;

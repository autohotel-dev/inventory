-- Script súper simple para limpiar inventory_movements

-- Ver la estructura actual
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'inventory_movements' 
ORDER BY ordinal_position;

-- LIMPIAR TODO - La solución más rápida
TRUNCATE TABLE inventory_movements;

-- Eliminar la columna qty si existe (ya que tienes quantity)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'qty'
    ) THEN
        ALTER TABLE inventory_movements DROP COLUMN qty;
        RAISE NOTICE 'Columna qty eliminada (ya existe quantity)';
    END IF;
END $$;

-- Agregar columnas que faltan
DO $$ 
BEGIN
    -- Agregar movement_type si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'movement_type'
    ) THEN
        ALTER TABLE inventory_movements 
        ADD COLUMN movement_type TEXT NOT NULL DEFAULT 'ADJUSTMENT'
        CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT'));
        RAISE NOTICE 'Columna movement_type agregada';
    END IF;

    -- Agregar reason si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'reason'
    ) THEN
        ALTER TABLE inventory_movements 
        ADD COLUMN reason TEXT NOT NULL DEFAULT 'Movimiento inicial';
        RAISE NOTICE 'Columna reason agregada';
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

END $$;

-- Asegurar que quantity tenga las restricciones correctas
DO $$
BEGIN
    -- Eliminar constraint existente si existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'inventory_movements' 
        AND constraint_name LIKE '%quantity%'
    ) THEN
        ALTER TABLE inventory_movements 
        DROP CONSTRAINT IF EXISTS inventory_movements_quantity_check;
    END IF;
    
    -- Agregar constraint correcto
    ALTER TABLE inventory_movements 
    ADD CONSTRAINT inventory_movements_quantity_check 
    CHECK (quantity > 0);
    
    RAISE NOTICE 'Constraint de quantity actualizado';
END $$;

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse_id ON inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);

-- Habilitar RLS
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Crear política
DO $$
BEGIN
    -- Eliminar política existente si existe
    DROP POLICY IF EXISTS "Allow all operations on inventory_movements" ON inventory_movements;
    
    -- Crear nueva política
    CREATE POLICY "Allow all operations on inventory_movements" 
    ON inventory_movements FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);
    
    RAISE NOTICE 'Política creada';
END $$;

-- Ver la estructura final
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'inventory_movements' 
ORDER BY ordinal_position;

-- Confirmar que está lista
SELECT 'Tabla inventory_movements limpia y lista' as status;

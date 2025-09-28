-- Script simple para limpiar y preparar la tabla inventory_movements

-- Ver cuántos registros tienes actualmente
SELECT COUNT(*) as total_registros FROM inventory_movements;

-- Ver la estructura actual
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'inventory_movements' 
ORDER BY ordinal_position;

-- OPCIÓN 1: LIMPIAR TODO (RECOMENDADO)
-- Eliminar todos los registros existentes para empezar limpio
TRUNCATE TABLE inventory_movements;

-- Verificar que esté vacía
SELECT COUNT(*) as registros_despues_limpiar FROM inventory_movements;

-- Ahora agregar las columnas que faltan
DO $$ 
BEGIN
    -- Renombrar qty a quantity si existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'qty'
    ) THEN
        ALTER TABLE inventory_movements 
        RENAME COLUMN qty TO quantity;
        RAISE NOTICE 'Columna qty renombrada a quantity';
    END IF;

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
    END IF;
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
SELECT 'Tabla inventory_movements lista para usar' as status;

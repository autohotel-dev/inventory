-- Script para verificar y corregir la tabla inventory_movements
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar estructura actual de la tabla
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'inventory_movements' 
ORDER BY ordinal_position;

-- 2. Si la tabla no existe o tiene estructura incorrecta, crearla/actualizarla
-- Primero, crear la tabla si no existe
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity DECIMAL(10,3) NOT NULL,
    movement_type VARCHAR(10) NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')),
    reason_code VARCHAR(20) NOT NULL,
    notes TEXT,
    reference_table VARCHAR(50),
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Agregar columnas faltantes si la tabla ya existe pero le faltan columnas
DO $$ 
BEGIN
    -- Agregar movement_type si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_movements' AND column_name = 'movement_type') THEN
        ALTER TABLE inventory_movements ADD COLUMN movement_type VARCHAR(10) NOT NULL DEFAULT 'ADJUSTMENT';
        ALTER TABLE inventory_movements ADD CONSTRAINT check_movement_type 
            CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT'));
    END IF;
    
    -- Agregar reason_code si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_movements' AND column_name = 'reason_code') THEN
        ALTER TABLE inventory_movements ADD COLUMN reason_code VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
    END IF;
    
    -- Agregar reference_table si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_movements' AND column_name = 'reference_table') THEN
        ALTER TABLE inventory_movements ADD COLUMN reference_table VARCHAR(50);
    END IF;
    
    -- Agregar reference_id si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'inventory_movements' AND column_name = 'reference_id') THEN
        ALTER TABLE inventory_movements ADD COLUMN reference_id UUID;
    END IF;
END $$;

-- 4. Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse_id ON inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON inventory_movements(reference_table, reference_id);

-- 5. Crear tabla de razones de movimiento si no existe
CREATE TABLE IF NOT EXISTS movement_reasons (
    code VARCHAR(20) PRIMARY KEY,
    description TEXT NOT NULL,
    movement_type VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Insertar razones básicas si la tabla está vacía
INSERT INTO movement_reasons (code, description, movement_type) VALUES
    ('SALE', 'Venta de producto', 'OUT'),
    ('PURCHASE', 'Compra de producto', 'IN'),
    ('ADJUSTMENT', 'Ajuste de inventario', 'ADJUSTMENT'),
    ('RETURN', 'Devolución', 'IN'),
    ('DAMAGE', 'Producto dañado', 'OUT'),
    ('TRANSFER', 'Transferencia entre almacenes', 'OUT')
ON CONFLICT (code) DO NOTHING;

-- 7. Habilitar RLS (Row Level Security) si es necesario
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- 8. Crear política básica de RLS (ajustar según necesidades)
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON inventory_movements;
CREATE POLICY "Enable all operations for authenticated users" ON inventory_movements
    FOR ALL USING (auth.role() = 'authenticated');

-- 9. Verificar que todo esté correcto
SELECT 'inventory_movements table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'inventory_movements' 
ORDER BY ordinal_position;

SELECT 'movement_reasons data:' as info;
SELECT * FROM movement_reasons ORDER BY code;

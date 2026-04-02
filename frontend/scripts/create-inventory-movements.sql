-- Script para crear la tabla de movimientos de inventario

-- Crear tabla de movimientos de inventario
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reason TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse_id ON inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);

-- Habilitar RLS (Row Level Security)
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones (ajustar según necesidades de seguridad)
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

-- Insertar algunos movimientos de ejemplo
DO $$
DECLARE
    sample_product_id UUID;
    sample_warehouse_id UUID;
BEGIN
    -- Obtener un producto de ejemplo
    SELECT id INTO sample_product_id FROM products LIMIT 1;
    
    -- Obtener un almacén de ejemplo
    SELECT id INTO sample_warehouse_id FROM warehouses LIMIT 1;
    
    -- Solo insertar si tenemos productos y almacenes
    IF sample_product_id IS NOT NULL AND sample_warehouse_id IS NOT NULL THEN
        INSERT INTO inventory_movements (product_id, warehouse_id, movement_type, quantity, reason, notes) VALUES 
        (sample_product_id, sample_warehouse_id, 'IN', 50, 'Compra inicial', 'Stock inicial del producto'),
        (sample_product_id, sample_warehouse_id, 'OUT', 5, 'Venta', 'Venta a cliente'),
        (sample_product_id, sample_warehouse_id, 'ADJUSTMENT', 40, 'Conteo físico', 'Ajuste después de inventario físico')
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Movimientos de ejemplo insertados';
    ELSE
        RAISE NOTICE 'No se pudieron insertar movimientos de ejemplo - faltan productos o almacenes';
    END IF;
END $$;

-- Verificar la estructura
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'inventory_movements' 
ORDER BY ordinal_position;

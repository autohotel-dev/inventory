-- Script para actualizar la tabla movement_reasons existente

-- Ver la estructura actual
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'movement_reasons' 
ORDER BY ordinal_position;

-- Ver registros existentes
SELECT * FROM movement_reasons;

-- Actualizar la tabla para que funcione con el sistema
DO $$ 
BEGIN
    -- Agregar movement_type si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'movement_reasons' 
        AND column_name = 'movement_type'
    ) THEN
        ALTER TABLE movement_reasons 
        ADD COLUMN movement_type TEXT;
        RAISE NOTICE 'Columna movement_type agregada';
    END IF;

    -- Agregar name si no existe (para mostrar en el formulario)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'movement_reasons' 
        AND column_name = 'name'
    ) THEN
        ALTER TABLE movement_reasons 
        ADD COLUMN name TEXT;
        RAISE NOTICE 'Columna name agregada';
    END IF;

    -- Agregar is_active si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'movement_reasons' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE movement_reasons 
        ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'Columna is_active agregada';
    END IF;

    -- Agregar created_at si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'movement_reasons' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE movement_reasons 
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Columna created_at agregada';
    END IF;

END $$;

-- Limpiar registros existentes para insertar los nuevos
-- Primero limpiar inventory_movements, luego movement_reasons
TRUNCATE TABLE inventory_movements, movement_reasons RESTART IDENTITY CASCADE;

-- Insertar razones predefinidas con la estructura correcta
INSERT INTO movement_reasons (code, name, description, movement_type, is_active) VALUES 
-- Razones para ENTRADAS (IN)
('PURCHASE', 'Compra', 'Compra de mercancía a proveedor', 'IN', true),
('CUSTOMER_RETURN', 'Devolución de cliente', 'Cliente devuelve producto', 'IN', true),
('PRODUCTION', 'Producción', 'Producto terminado de producción interna', 'IN', true),
('TRANSFER_IN', 'Transferencia entrada', 'Transferencia desde otro almacén', 'IN', true),
('POSITIVE_ADJ', 'Ajuste positivo', 'Ajuste de inventario - incremento', 'IN', true),

-- Razones para SALIDAS (OUT)
('SALE', 'Venta', 'Venta a cliente', 'OUT', true),
('SUPPLIER_RETURN', 'Devolución a proveedor', 'Devolución de mercancía defectuosa', 'OUT', true),
('DAMAGED', 'Producto dañado', 'Producto dañado o vencido', 'OUT', true),
('TRANSFER_OUT', 'Transferencia salida', 'Transferencia a otro almacén', 'OUT', true),
('INTERNAL_USE', 'Uso interno', 'Consumo interno de la empresa', 'OUT', true),
('SHRINKAGE', 'Merma', 'Pérdida por merma natural', 'OUT', true),

-- Razones para AJUSTES (ADJUSTMENT)
('PHYSICAL_COUNT', 'Conteo físico', 'Ajuste por inventario físico', 'ADJUSTMENT', true),
('ERROR_CORRECTION', 'Corrección de error', 'Corrección de error de captura', 'ADJUSTMENT', true),
('INITIAL_LOAD', 'Ajuste inicial', 'Carga inicial de inventario', 'ADJUSTMENT', true),
('RECOUNT', 'Reconteo', 'Ajuste por reconteo de mercancía', 'ADJUSTMENT', true);

-- Crear índice para movement_type
CREATE INDEX IF NOT EXISTS idx_movement_reasons_type ON movement_reasons(movement_type);

-- Agregar constraint para movement_type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'movement_reasons' 
        AND constraint_name = 'check_movement_type'
    ) THEN
        ALTER TABLE movement_reasons 
        ADD CONSTRAINT check_movement_type 
        CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT'));
        RAISE NOTICE 'Constraint check_movement_type agregado';
    END IF;
END $$;

-- Verificar que se crearon las razones
SELECT movement_type, COUNT(*) as cantidad_razones 
FROM movement_reasons 
GROUP BY movement_type 
ORDER BY movement_type;

-- Mostrar todas las razones disponibles
SELECT id, code, name, movement_type, description 
FROM movement_reasons 
ORDER BY movement_type, id;

-- Ver la estructura final
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'movement_reasons' 
ORDER BY ordinal_position;

SELECT 'Tabla movement_reasons actualizada y lista' as status;

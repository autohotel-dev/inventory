-- Script para verificar los IDs de las razones de movimiento
-- Ejecutar en Supabase SQL Editor

-- Verificar qué razones existen en la tabla movement_reasons
SELECT id, code, description, movement_type, is_active 
FROM movement_reasons 
ORDER BY id;

-- Si la tabla está vacía, insertar razones básicas
INSERT INTO movement_reasons (code, description, movement_type, is_active) VALUES
    ('SALE', 'Venta de producto', 'OUT', true),
    ('PURCHASE', 'Compra de producto', 'IN', true),
    ('ADJUSTMENT', 'Ajuste de inventario', 'ADJUSTMENT', true),
    ('RETURN', 'Devolución', 'IN', true),
    ('DAMAGE', 'Producto dañado', 'OUT', true),
    ('TRANSFER', 'Transferencia entre almacenes', 'OUT', true)
ON CONFLICT (code) DO NOTHING;

-- Verificar los IDs después de la inserción
SELECT id, code, description, movement_type, is_active 
FROM movement_reasons 
ORDER BY id;

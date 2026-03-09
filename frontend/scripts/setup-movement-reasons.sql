-- Script para crear la tabla movement_reasons que falta

-- Crear tabla movement_reasons si no existe
CREATE TABLE IF NOT EXISTS movement_reasons (
    id SERIAL PRIMARY KEY,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice
CREATE INDEX IF NOT EXISTS idx_movement_reasons_type ON movement_reasons(movement_type);

-- Insertar razones predefinidas
INSERT INTO movement_reasons (movement_type, name, description) VALUES 
-- Razones para ENTRADAS (IN)
('IN', 'Compra', 'Compra de mercancía a proveedor'),
('IN', 'Devolución de cliente', 'Cliente devuelve producto'),
('IN', 'Producción', 'Producto terminado de producción interna'),
('IN', 'Transferencia entrada', 'Transferencia desde otro almacén'),
('IN', 'Ajuste positivo', 'Ajuste de inventario - incremento'),

-- Razones para SALIDAS (OUT)
('OUT', 'Venta', 'Venta a cliente'),
('OUT', 'Devolución a proveedor', 'Devolución de mercancía defectuosa'),
('OUT', 'Producto dañado', 'Producto dañado o vencido'),
('OUT', 'Transferencia salida', 'Transferencia a otro almacén'),
('OUT', 'Uso interno', 'Consumo interno de la empresa'),
('OUT', 'Merma', 'Pérdida por merma natural'),

-- Razones para AJUSTES (ADJUSTMENT)
('ADJUSTMENT', 'Conteo físico', 'Ajuste por inventario físico'),
('ADJUSTMENT', 'Corrección de error', 'Corrección de error de captura'),
('ADJUSTMENT', 'Ajuste inicial', 'Carga inicial de inventario'),
('ADJUSTMENT', 'Reconteo', 'Ajuste por reconteo de mercancía')

ON CONFLICT DO NOTHING;

-- Verificar que se crearon las razones
SELECT movement_type, COUNT(*) as cantidad_razones 
FROM movement_reasons 
GROUP BY movement_type 
ORDER BY movement_type;

-- Mostrar todas las razones disponibles
SELECT id, movement_type, name, description 
FROM movement_reasons 
ORDER BY movement_type, id;

-- Limpiar la tabla inventory_movements para empezar limpio
TRUNCATE TABLE inventory_movements;

-- Verificar que todo está listo
SELECT 'Tabla movement_reasons creada y inventory_movements limpia' as status;

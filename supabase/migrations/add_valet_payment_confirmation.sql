-- Migración: Sistema de Confirmación de Pagos para Cocheros
-- Descripción: Agrega campos de auditoría y estado COBRADO_POR_VALET para permitir
--              que cocheros registren cobros y recepcionistas los confirmen

-- 1. Agregar nuevo estado COBRADO_POR_VALET al constraint
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payments 
ADD CONSTRAINT payments_status_check 
CHECK (status IN (
  'PENDIENTE',
  'COBRADO_POR_VALET',  -- Nuevo: Cochero cobró, esperando confirmación de recepción
  'PAGADO',
  'CANCELADO'
));

-- 2. Agregar campos de auditoría para trazabilidad
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS collected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;

-- 3. Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_payments_status_valet 
ON payments(status) 
WHERE status = 'COBRADO_POR_VALET';

CREATE INDEX IF NOT EXISTS idx_payments_collected_by 
ON payments(collected_by)
WHERE collected_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_confirmed_by 
ON payments(confirmed_by)
WHERE confirmed_by IS NOT NULL;

-- 4. Comentarios para documentación
COMMENT ON COLUMN payments.collected_by IS 'Empleado (cochero) que cobró al cliente';
COMMENT ON COLUMN payments.collected_at IS 'Timestamp cuando cochero registró el cobro';
COMMENT ON COLUMN payments.confirmed_by IS 'Empleado (recepcionista) que confirmó recepción del dinero';
COMMENT ON COLUMN payments.confirmed_at IS 'Timestamp cuando recepción confirmó el pago';

-- 5. Queries útiles para desarrollo/debugging

-- Ver pagos pendientes de confirmación
-- SELECT 
--   p.id,
--   p.amount,
--   p.payment_method,
--   p.reference,
--   p.created_at,
--   p.collected_at,
--   collector.first_name || ' ' || collector.last_name as collected_by_name,
--   rs.room_id
-- FROM payments p
-- LEFT JOIN employees collector ON p.collected_by = collector.id
-- LEFT JOIN sales_orders so ON p.sales_order_id = so.id
-- LEFT JOIN room_stays rs ON so.id = rs.sales_order_id
-- WHERE p.status = 'COBRADO_POR_VALET'
-- ORDER BY p.collected_at DESC;

-- Ver auditoría completa de un pago
-- SELECT 
--   p.*,
--   collector.first_name || ' ' || collector.last_name as collector_name,
--   confirmer.first_name || ' ' || confirmer.last_name as confirmer_name
-- FROM payments p
-- LEFT JOIN employees collector ON p.collected_by = collector.id
-- LEFT JOIN employees confirmer ON p.confirmed_by = confirmer.id
-- WHERE p.id = 'PAYMENT_ID_HERE';

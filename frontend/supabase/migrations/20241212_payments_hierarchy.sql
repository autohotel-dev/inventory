-- Estructura jerárquica de pagos
-- Un cargo principal puede tener múltiples subpagos (multipago)
-- Si es pago único, no tiene subpagos

-- Agregar campo parent_payment_id para relacionar subpagos con cargo principal
ALTER TABLE payments ADD COLUMN IF NOT EXISTS parent_payment_id UUID REFERENCES payments(id) ON DELETE CASCADE DEFAULT NULL;

-- Índice para búsquedas de subpagos
CREATE INDEX IF NOT EXISTS idx_payments_parent_id ON payments(parent_payment_id);

-- Actualizar comentarios
COMMENT ON COLUMN payments.parent_payment_id IS 'ID del pago principal si este es un subpago. NULL si es pago principal o pago único.';

-- Vista para obtener pagos con sus subpagos
CREATE OR REPLACE VIEW payments_with_subpayments AS
SELECT 
  p.id,
  p.sales_order_id,
  p.payment_number,
  p.amount,
  p.payment_method,
  p.reference,
  p.concept,
  p.status,
  p.payment_type,
  p.parent_payment_id,
  p.created_at,
  COALESCE(
    (SELECT SUM(sp.amount) FROM payments sp WHERE sp.parent_payment_id = p.id),
    0
  ) as total_subpayments,
  (SELECT COUNT(*) FROM payments sp WHERE sp.parent_payment_id = p.id) as subpayment_count
FROM payments p
WHERE p.parent_payment_id IS NULL;

-- Mejorar tabla de pagos con campos adicionales para mejor tracking
-- Agrega: payment_number (identificador legible), status, payment_type

-- Agregar campo payment_number para identificador legible (P001, P002, etc.)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_number TEXT DEFAULT NULL;

-- Agregar campo status para estado del pago
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PAGADO' 
  CHECK (status IN ('PAGADO', 'PENDIENTE', 'CANCELADO'));

-- Agregar campo payment_type para indicar el tipo de pago
-- COMPLETO: pago único con un solo método
-- PARCIAL: subpago que forma parte de un multipago
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'COMPLETO'
  CHECK (payment_type IN ('PARCIAL', 'COMPLETO'));

-- Índice para búsquedas por payment_number
CREATE INDEX IF NOT EXISTS idx_payments_payment_number ON payments(payment_number);

-- Índice para búsquedas por status
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Función para generar payment_number automáticamente
CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  order_prefix TEXT;
BEGIN
  -- Obtener el número de pagos existentes para esta orden
  SELECT COUNT(*) + 1 INTO next_num
  FROM payments
  WHERE sales_order_id = NEW.sales_order_id;
  
  -- Generar el payment_number como P001, P002, etc.
  NEW.payment_number := 'P' || LPAD(next_num::TEXT, 3, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para asignar payment_number automáticamente
DROP TRIGGER IF EXISTS trigger_generate_payment_number ON payments;
CREATE TRIGGER trigger_generate_payment_number
  BEFORE INSERT ON payments
  FOR EACH ROW
  WHEN (NEW.payment_number IS NULL)
  EXECUTE FUNCTION generate_payment_number();

-- Comentarios para documentación
COMMENT ON COLUMN payments.payment_number IS 'Identificador legible del pago (P001, P002, etc.) único por orden';
COMMENT ON COLUMN payments.status IS 'Estado del pago: PAGADO, PENDIENTE, CANCELADO';
COMMENT ON COLUMN payments.payment_type IS 'Tipo de pago: PARCIAL o COMPLETO';

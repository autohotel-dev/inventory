-- Crear tabla de pagos para soportar multipagos
-- Permite registrar múltiples pagos con diferentes métodos para una misma orden

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'PENDIENTE')),
  reference TEXT DEFAULT NULL, -- Referencia opcional (últimos 4 dígitos de tarjeta, número de transferencia, etc.)
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) DEFAULT NULL
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_payments_sales_order_id ON payments(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);

-- Comentarios para documentación
COMMENT ON TABLE payments IS 'Tabla de pagos que permite múltiples pagos por orden con diferentes métodos';
COMMENT ON COLUMN payments.amount IS 'Monto del pago';
COMMENT ON COLUMN payments.payment_method IS 'Método de pago: EFECTIVO, TARJETA o TRANSFERENCIA';
COMMENT ON COLUMN payments.reference IS 'Referencia opcional del pago (últimos 4 dígitos, número de transferencia, etc.)';

-- Habilitar RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones (ajustar según necesidades de seguridad)
CREATE POLICY "Allow all operations on payments" ON payments
  FOR ALL
  USING (true)
  WITH CHECK (true);

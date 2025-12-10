-- Agregar campo de método de pago a sales_orders

ALTER TABLE sales_orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL 
CHECK (payment_method IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', NULL));

-- Comentario para documentación
COMMENT ON COLUMN sales_orders.payment_method IS 'Método de pago: EFECTIVO, TARJETA o TRANSFERENCIA';

-- Agregar campo de método de pago a sales_order_items
-- Permite rastrear con qué método se pagó cada producto individual

ALTER TABLE sales_order_items 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL 
CHECK (payment_method IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', NULL));

-- Comentario para documentación
COMMENT ON COLUMN sales_order_items.payment_method IS 'Método de pago para este producto: EFECTIVO, TARJETA o TRANSFERENCIA';

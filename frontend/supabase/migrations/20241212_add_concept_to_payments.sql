-- Agregar campo concept a la tabla payments para identificar el tipo de pago
-- Ejemplos: 'ESTANCIA', 'HORA_EXTRA', 'PERSONA_EXTRA', 'CONSUMO', 'CHECKOUT'

ALTER TABLE payments ADD COLUMN IF NOT EXISTS concept TEXT DEFAULT NULL;

-- Comentario para documentación
COMMENT ON COLUMN payments.concept IS 'Concepto del pago: ESTANCIA, HORA_EXTRA, PERSONA_EXTRA, CONSUMO, CHECKOUT, etc.';

-- Índice para búsquedas por concepto
CREATE INDEX IF NOT EXISTS idx_payments_concept ON payments(concept);

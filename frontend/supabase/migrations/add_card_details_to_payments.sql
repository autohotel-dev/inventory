-- Migración: Agregar detalles de tarjeta a la tabla payments
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columnas para detalles de tarjeta
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS card_last_4 VARCHAR(4),
ADD COLUMN IF NOT EXISTS card_type VARCHAR(10);

-- 2. Agregar comentarios descriptivos
COMMENT ON COLUMN payments.card_last_4 IS 'Últimos 4 dígitos de la tarjeta (solo para pagos con tarjeta)';
COMMENT ON COLUMN payments.card_type IS 'Tipo de tarjeta: CREDITO o DEBITO (solo para pagos con tarjeta)';

-- 3. Agregar índice para búsquedas por tarjeta (opcional pero recomendado)
CREATE INDEX IF NOT EXISTS idx_payments_card_last_4 ON payments(card_last_4) WHERE card_last_4 IS NOT NULL;

-- 4. Verificar que las columnas se crearon correctamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'payments' 
  AND column_name IN ('card_last_4', 'card_type')
ORDER BY ordinal_position;

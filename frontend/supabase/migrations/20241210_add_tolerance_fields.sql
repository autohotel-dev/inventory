-- Agregar campos de tolerancia a room_stays para habitaciones de motel
-- Estos campos NO aplican para habitaciones de hotel/torre (is_hotel = true)

-- Campo para registrar cuando inició la tolerancia de 1 hora
ALTER TABLE room_stays 
ADD COLUMN IF NOT EXISTS tolerance_started_at TIMESTAMPTZ DEFAULT NULL;

-- Campo para indicar el tipo de tolerancia activa
-- 'PERSON_LEFT': Una persona salió pero quedan otras (si regresa después de 1h = persona extra)
-- 'ROOM_EMPTY': Todos salieron (si no regresan después de 1h = cobrar habitación completa)
ALTER TABLE room_stays 
ADD COLUMN IF NOT EXISTS tolerance_type TEXT DEFAULT NULL 
CHECK (tolerance_type IN ('PERSON_LEFT', 'ROOM_EMPTY', NULL));

-- Comentarios para documentación
COMMENT ON COLUMN room_stays.tolerance_started_at IS 'Timestamp cuando inició el período de tolerancia de 1 hora (solo motel)';
COMMENT ON COLUMN room_stays.tolerance_type IS 'Tipo de tolerancia: PERSON_LEFT (persona salió) o ROOM_EMPTY (habitación vacía)';

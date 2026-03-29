-- =====================================================
-- AGREGAR CAMPOS DE VEHÍCULO A ROOM_STAYS
-- =====================================================
-- Ejecutar en Supabase SQL Editor

-- Agregar columnas para información del vehículo
ALTER TABLE room_stays 
ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS vehicle_brand VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS vehicle_model VARCHAR(50) DEFAULT NULL;

-- Comentarios
COMMENT ON COLUMN room_stays.vehicle_plate IS 'Placas del vehículo del huésped';
COMMENT ON COLUMN room_stays.vehicle_brand IS 'Marca del vehículo (ej: Toyota, Honda, Ford)';
COMMENT ON COLUMN room_stays.vehicle_model IS 'Modelo del vehículo (ej: Corolla, Civic, F-150)';

-- Índice para búsqueda por placas (útil para seguridad)
CREATE INDEX IF NOT EXISTS idx_room_stays_vehicle_plate ON room_stays(vehicle_plate) WHERE vehicle_plate IS NOT NULL;

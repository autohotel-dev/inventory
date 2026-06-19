-- Migración: Soporte multi-persona para tolerancia de salida
-- Agrega campo para rastrear cuántas personas salieron con tolerancia activa

-- Campo para registrar cuántas personas salieron con tolerancia
ALTER TABLE room_stays
  ADD COLUMN IF NOT EXISTS tolerance_people_out INTEGER DEFAULT 0;

COMMENT ON COLUMN room_stays.tolerance_people_out
  IS 'Número de personas que salieron con tolerancia activa. 0 = sin tolerancia.';

-- Actualizar constraint de tolerance_type para incluir validación
-- (tolerance_type ya tiene CHECK, no necesita cambio)

-- IMPORTANTE: Si el RPC get_rooms_dashboard usa SELECT explícito en room_stays,
-- agregar tolerance_people_out a la lista de campos seleccionados.
-- Si usa SELECT *, el campo se incluirá automáticamente.

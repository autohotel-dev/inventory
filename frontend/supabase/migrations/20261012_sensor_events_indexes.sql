-- Historial de cocheras: el popover de habitación consulta por sensor y el reporte
-- de actividad por día; sin índices ambas consultas recorren toda la tabla.
CREATE INDEX IF NOT EXISTS idx_sensor_events_sensor_created
  ON public.sensor_events (sensor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_events_created
  ON public.sensor_events (created_at DESC);

COMMENT ON COLUMN public.sensors.is_open IS
  'Estado de la cochera. NULL = el hub aún no lo conoce (tras reiniciarse, hasta que la cochera se mueva).';

COMMENT ON COLUMN public.sensors.last_seen IS
  'Último reporte. El daemon local lo renueva cada 2 min (latido) mientras el hub vea el sensor; viejo = sin señal.';

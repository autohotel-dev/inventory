-- ====================================================================
-- MIGRATION: Evidencia fotográfica de mantenimiento
-- Description: Crea el bucket maintenance_reports y agrega 
-- maintenance_image_url a la tabla rooms.
-- ====================================================================

-- 1. Agregar columna a la tabla rooms
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS maintenance_image_url TEXT;

COMMENT ON COLUMN public.rooms.maintenance_image_url IS 'URL pública de la foto de evidencia de mantenimiento/daño cuando la habitación está BLOQUEADA';

-- 2. Crear bucket de storage para reportes de mantenimiento
INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance_reports', 'maintenance_reports', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas RLS para el bucket 'maintenance_reports'
-- (Asegurarse de que el usuario autenticado pueda subir imágenes)

-- Permitir lectura a todos (ya que la URL es pública)
CREATE POLICY "Public Access for maintenance_reports" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'maintenance_reports');

-- Permitir inserción a usuarios autenticados (empleados)
CREATE POLICY "Auth Insert for maintenance_reports" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'maintenance_reports');

-- Permitir actualización a usuarios autenticados
CREATE POLICY "Auth Update for maintenance_reports" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'maintenance_reports')
WITH CHECK (bucket_id = 'maintenance_reports');

-- Permitir borrado a usuarios autenticados (necesario para cuando limpian la foto o para limpiezas programadas)
CREATE POLICY "Auth Delete for maintenance_reports" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'maintenance_reports');

-- 4. Script para limpieza de un mes (Para ejecutar manualmente o vía pg_cron si está instalado)
-- 
-- Si Supabase tiene pg_cron habilitado, puedes descomentar esto:
-- SELECT cron.schedule(
--   'cleanup_old_maintenance_images',
--   '0 3 * * *', -- Ejecutar a las 3 AM todos los días
--   $$
--   DELETE FROM storage.objects 
--   WHERE bucket_id = 'maintenance_reports' 
--   AND created_at < NOW() - INTERVAL '30 days';
--   $$
-- );
--
-- NOTA: Como la política RLS y la limpieza de storage.objects es suficiente,
-- el enlace en "rooms" podría apuntar a un archivo inexistente después de 30 días,
-- pero el frontend debe manejar el error de carga de imagen transparentemente.

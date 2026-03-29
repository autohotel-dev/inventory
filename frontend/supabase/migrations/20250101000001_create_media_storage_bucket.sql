-- Crear bucket de storage para archivos de medios
INSERT INTO storage.buckets (id, name, public)
VALUES ('media-files', 'media-files', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies para el bucket
CREATE POLICY "Los archivos son visibles públicamente"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'media-files');

CREATE POLICY "Usuarios autenticados pueden subir archivos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'media-files');

CREATE POLICY "Usuarios pueden actualizar sus propios archivos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'media-files' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuarios pueden eliminar sus propios archivos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'media-files' AND (auth.uid())::text = (storage.foldername(name))[1]);

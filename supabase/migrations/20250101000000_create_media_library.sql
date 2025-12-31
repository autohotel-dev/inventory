-- Crear tabla para biblioteca de medios
CREATE TABLE IF NOT EXISTS media_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE, -- Ruta en storage (bucket/folder/filename)
    file_url TEXT NOT NULL, -- URL pública del archivo
    file_type TEXT NOT NULL CHECK (file_type IN ('image', 'document', 'other')),
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('logo', 'banner', 'document', 'other')),
    description TEXT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda y filtrado
CREATE INDEX idx_media_library_category ON media_library(category);
CREATE INDEX idx_media_library_file_type ON media_library(file_type);
CREATE INDEX idx_media_library_uploaded_by ON media_library(uploaded_by);
CREATE INDEX idx_media_library_created_at ON media_library(created_at DESC);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_media_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_media_library_updated_at
    BEFORE UPDATE ON media_library
    FOR EACH ROW
    EXECUTE FUNCTION update_media_library_updated_at();

-- RLS Policies
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver los archivos públicos
CREATE POLICY "Los archivos son visibles para todos los usuarios autenticados"
    ON media_library FOR SELECT
    TO authenticated
    USING (true);

-- Solo usuarios autenticados pueden subir archivos
CREATE POLICY "Usuarios autenticados pueden subir archivos"
    ON media_library FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = uploaded_by);

-- Los usuarios pueden actualizar sus propios archivos
CREATE POLICY "Usuarios pueden actualizar sus propios archivos"
    ON media_library FOR UPDATE
    TO authenticated
    USING (auth.uid() = uploaded_by)
    WITH CHECK (auth.uid() = uploaded_by);

-- Los usuarios pueden eliminar sus propios archivos
CREATE POLICY "Usuarios pueden eliminar sus propios archivos"
    ON media_library FOR DELETE
    TO authenticated
    USING (auth.uid() = uploaded_by);

-- Comentarios para documentación
COMMENT ON TABLE media_library IS 'Biblioteca de medios para almacenar logos, imágenes y documentos';
COMMENT ON COLUMN media_library.file_path IS 'Ruta relativa del archivo en Supabase Storage';
COMMENT ON COLUMN media_library.file_url IS 'URL pública completa del archivo';
COMMENT ON COLUMN media_library.category IS 'Categoría del archivo: logo, banner, document, other';

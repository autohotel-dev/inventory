-- Script para agregar campos de rechazo y historial de revisiones a shift_closings
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna para motivo de rechazo
ALTER TABLE shift_closings 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Agregar columna para el corte original (cuando se re-hace un corte rechazado)
ALTER TABLE shift_closings 
ADD COLUMN IF NOT EXISTS original_closing_id UUID REFERENCES shift_closings(id);

-- 3. Agregar columna para marcar si es una corrección
ALTER TABLE shift_closings 
ADD COLUMN IF NOT EXISTS is_correction BOOLEAN DEFAULT FALSE;

-- 4. Crear tabla para historial de revisiones
CREATE TABLE IF NOT EXISTS shift_closing_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_closing_id UUID NOT NULL REFERENCES shift_closings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES employees(id),
  action VARCHAR(20) NOT NULL CHECK (action IN ('approved', 'rejected', 'pending')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_shift_closing_reviews_closing_id 
ON shift_closing_reviews(shift_closing_id);

CREATE INDEX IF NOT EXISTS idx_shift_closings_original_id 
ON shift_closings(original_closing_id);

CREATE INDEX IF NOT EXISTS idx_shift_closings_status 
ON shift_closings(status);

-- 6. Habilitar RLS en la nueva tabla
ALTER TABLE shift_closing_reviews ENABLE ROW LEVEL SECURITY;

-- 7. Política para que todos puedan leer las revisiones
CREATE POLICY "Allow read shift_closing_reviews" ON shift_closing_reviews
FOR SELECT USING (true);

-- 8. Política para que solo admins/managers puedan insertar revisiones
CREATE POLICY "Allow insert shift_closing_reviews for admins" ON shift_closing_reviews
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE id = reviewer_id 
    AND role IN ('admin', 'manager')
  )
);

-- Verificar que las columnas se crearon correctamente
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shift_closings' 
AND column_name IN ('rejection_reason', 'original_closing_id', 'is_correction');

-- =====================================================
-- MIGRACIÓN: Campos para Entrega de Consumos
-- =====================================================
-- Esta migración agrega campos a sales_order_items para rastrear
-- qué cochero aceptó entregar un consumo y cuándo.

-- =====================================================
-- PASO 1: AGREGAR COLUMNAS DE ENTREGA
-- =====================================================
ALTER TABLE public.sales_order_items
ADD COLUMN IF NOT EXISTS delivery_accepted_by UUID REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS delivery_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivery_completed_at TIMESTAMPTZ;

-- =====================================================
-- PASO 2: COMENTARIOS
-- =====================================================
COMMENT ON COLUMN public.sales_order_items.delivery_accepted_by IS 
  'ID del empleado (cochero) que aceptó entregar este consumo a la habitación';

COMMENT ON COLUMN public.sales_order_items.delivery_accepted_at IS 
  'Timestamp de cuando el cochero aceptó la entrega del consumo';

COMMENT ON COLUMN public.sales_order_items.delivery_completed_at IS 
  'Timestamp de cuando se completó la entrega del consumo (opcional)';

-- =====================================================
-- PASO 3: ÍNDICE PARA CONSULTAS DE CONSUMOS PENDIENTES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_sales_order_items_pending_delivery
ON public.sales_order_items (delivery_accepted_by)
WHERE concept_type = 'CONSUMPTION' AND delivery_accepted_by IS NULL;

-- =====================================================
-- PASO 4: HABILITAR REALTIME PARA LA TABLA
-- =====================================================
-- Nota: La tabla sales_order_items debe estar habilitada para Realtime
-- para que los cocheros reciban notificaciones en tiempo real.
-- Esto se puede hacer desde el dashboard de Supabase o con:

ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_order_items;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✓ Migración completada: Campos de entrega de consumos agregados';
  RAISE NOTICE '  - delivery_accepted_by: UUID del cochero que acepta';
  RAISE NOTICE '  - delivery_accepted_at: Timestamp de aceptación';
  RAISE NOTICE '  - delivery_completed_at: Timestamp de completado';
  RAISE NOTICE '  - Índice para consultas de consumos pendientes creado';
  RAISE NOTICE '  - Tabla agregada a Realtime publication';
END $$;

-- =====================================================
-- MIGRACIÓN: Sistema Completo de Tracking de Consumos
-- =====================================================
-- Agrega campos para trazabilidad completa de entregas
-- de consumos por cocheros, incluyendo propinas.

-- =====================================================
-- PASO 1: AGREGAR CAMPO DE ESTADO DE ENTREGA
-- =====================================================
ALTER TABLE public.sales_order_items
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'PENDING_VALET';

-- Constraint para estados válidos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'sales_order_items_delivery_status_check'
    ) THEN
        ALTER TABLE public.sales_order_items
        ADD CONSTRAINT sales_order_items_delivery_status_check
        CHECK (delivery_status IN (
            'PENDING_VALET',  -- Esperando que cochero acepte
            'ACCEPTED',       -- Cochero aceptó, esperando recogida
            'IN_TRANSIT',     -- Cochero recogió, en camino
            'DELIVERED',      -- Entregado, esperando confirmación de pago
            'COMPLETED',      -- Todo completado
            'ISSUE',          -- Hay un problema
            'CANCELLED'       -- Cancelado
        ));
    END IF;
END $$;

-- =====================================================
-- PASO 2: AGREGAR CAMPOS DE TRACKING DE RECOGIDA
-- =====================================================
ALTER TABLE public.sales_order_items
ADD COLUMN IF NOT EXISTS delivery_picked_up_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivery_picked_up_by UUID REFERENCES public.employees(id);

COMMENT ON COLUMN public.sales_order_items.delivery_picked_up_at IS 
  'Timestamp cuando recepción confirma que el cochero recogió los productos';
COMMENT ON COLUMN public.sales_order_items.delivery_picked_up_by IS 
  'ID del empleado de recepción que confirmó la recogida';

-- =====================================================
-- PASO 3: AGREGAR CAMPOS DE PAGO RECIBIDO
-- =====================================================
ALTER TABLE public.sales_order_items
ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_received_by UUID REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS payment_amount_received NUMERIC;

COMMENT ON COLUMN public.sales_order_items.payment_received_at IS 
  'Timestamp cuando recepción confirma que el cochero trajo el dinero';
COMMENT ON COLUMN public.sales_order_items.payment_received_by IS 
  'ID del empleado de recepción que confirmó la recepción del dinero';
COMMENT ON COLUMN public.sales_order_items.payment_amount_received IS 
  'Monto real recibido (puede diferir del total si hubo problema)';

-- =====================================================
-- PASO 4: AGREGAR CAMPOS DE PROPINA
-- =====================================================
ALTER TABLE public.sales_order_items
ADD COLUMN IF NOT EXISTS tip_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tip_method TEXT;

-- Constraint para métodos de propina válidos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'sales_order_items_tip_method_check'
    ) THEN
        ALTER TABLE public.sales_order_items
        ADD CONSTRAINT sales_order_items_tip_method_check
        CHECK (tip_method IN ('EFECTIVO', 'TARJETA') OR tip_method IS NULL);
    END IF;
END $$;

COMMENT ON COLUMN public.sales_order_items.tip_amount IS 
  'Monto de propina que el cliente dio al cochero';
COMMENT ON COLUMN public.sales_order_items.tip_method IS 
  'Método de pago de la propina: EFECTIVO o TARJETA';

-- =====================================================
-- PASO 5: AGREGAR CAMPOS DE NOTAS Y PROBLEMAS
-- =====================================================
ALTER TABLE public.sales_order_items
ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS issue_description TEXT;

COMMENT ON COLUMN public.sales_order_items.delivery_notes IS 
  'Notas generales sobre la entrega';
COMMENT ON COLUMN public.sales_order_items.cancellation_reason IS 
  'Motivo de cancelación si el estado es CANCELLED';
COMMENT ON COLUMN public.sales_order_items.issue_description IS 
  'Descripción del problema si el estado es ISSUE';

-- =====================================================
-- PASO 6: ÍNDICES PARA CONSULTAS EFICIENTES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_sales_order_items_delivery_status
ON public.sales_order_items (delivery_status)
WHERE concept_type = 'CONSUMPTION';

CREATE INDEX IF NOT EXISTS idx_sales_order_items_valet_pending
ON public.sales_order_items (delivery_accepted_by, delivery_status)
WHERE concept_type = 'CONSUMPTION' AND delivery_status IN ('ACCEPTED', 'IN_TRANSIT');

-- =====================================================
-- PASO 7: ACTUALIZAR CONSUMOS EXISTENTES
-- =====================================================
-- Establecer estado inicial para consumos existentes
UPDATE public.sales_order_items
SET delivery_status = CASE
    WHEN delivery_completed_at IS NOT NULL THEN 'COMPLETED'
    WHEN delivery_accepted_by IS NOT NULL THEN 'ACCEPTED'
    ELSE 'PENDING_VALET'
END
WHERE concept_type = 'CONSUMPTION'
AND delivery_status IS NULL;

-- Para consumos ya pagados, marcar como completados
UPDATE public.sales_order_items
SET delivery_status = 'COMPLETED'
WHERE concept_type = 'CONSUMPTION'
AND is_paid = true
AND delivery_status = 'PENDING_VALET';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✓ Migración completada: Sistema de tracking de consumos';
  RAISE NOTICE '  Campos agregados:';
  RAISE NOTICE '  - delivery_status (estado de entrega)';
  RAISE NOTICE '  - delivery_picked_up_at/by (recogida confirmada)';
  RAISE NOTICE '  - payment_received_at/by/amount (pago recibido)';
  RAISE NOTICE '  - tip_amount, tip_method (propinas)';
  RAISE NOTICE '  - delivery_notes, cancellation_reason, issue_description';
  RAISE NOTICE '  Índices creados para consultas eficientes';
END $$;

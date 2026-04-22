-- ================================================================
-- MIGRATION: Add shift_session_id to sales_order_items
-- Description: Allows tracking of individual items to specific shifts
-- ================================================================

-- 1. Add shift_session_id to sales_order_items
ALTER TABLE public.sales_order_items 
ADD COLUMN IF NOT EXISTS shift_session_id UUID REFERENCES public.shift_sessions(id) ON DELETE SET NULL;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_sales_order_items_shift_session ON public.sales_order_items(shift_session_id);

-- 3. Backfill existing data
-- We set the shift_session_id to the parent sales_order's shift_session_id for historical data.
-- This preserves the old behavior for past shift closings.
UPDATE public.sales_order_items soi
SET shift_session_id = so.shift_session_id
FROM public.sales_orders so
WHERE soi.sales_order_id = so.id
AND soi.shift_session_id IS NULL;

-- 4. Comment on the column
COMMENT ON COLUMN public.sales_order_items.shift_session_id IS 'The shift session active when this specific item was created or registered.';

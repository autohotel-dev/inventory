-- Add courtesy fields to sales_order_items
ALTER TABLE public.sales_order_items 
ADD COLUMN IF NOT EXISTS is_courtesy BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS courtesy_reason TEXT DEFAULT NULL;

COMMENT ON COLUMN public.sales_order_items.is_courtesy IS 'Indica si este ítem es una cortesía (precio 0)';
COMMENT ON COLUMN public.sales_order_items.courtesy_reason IS 'Razón por la cual se otorgó la cortesía';

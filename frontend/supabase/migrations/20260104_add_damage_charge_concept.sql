-- Add DAMAGE_CHARGE to concept_type constraint
-- This allows damage charges to create sales_order_items

-- Drop the existing constraint
ALTER TABLE sales_order_items 
DROP CONSTRAINT IF EXISTS sales_order_items_concept_type_check;

-- Add the new constraint with DAMAGE_CHARGE included
ALTER TABLE sales_order_items 
ADD CONSTRAINT sales_order_items_concept_type_check 
CHECK (
  concept_type IN (
    'ROOM_BASE',
    'EXTRA_HOUR',
    'EXTRA_PERSON',
    'CONSUMPTION',
    'PRODUCT',
    'RENEWAL',
    'PROMO_4H',
    'TOLERANCE_EXPIRED',
    'DAMAGE_CHARGE'
  )
);

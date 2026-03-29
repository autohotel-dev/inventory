-- Migration: Add RENEWAL and PROMO_4H to concept_type constraint
-- This allows room renewals and 4-hour promos to create sales_order_items

-- Drop the existing constraint
ALTER TABLE sales_order_items 
DROP CONSTRAINT IF EXISTS sales_order_items_concept_type_check;

-- Add the new constraint with RENEWAL and PROMO_4H included
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
    'TOLERANCE_EXPIRED'
  )
);

-- Verify the constraint was updated
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'sales_order_items_concept_type_check';

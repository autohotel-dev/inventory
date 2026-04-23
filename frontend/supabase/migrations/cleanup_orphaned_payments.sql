DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN 
    SELECT p.id, p.sales_order_id, p.amount 
    FROM payments p
    WHERE p.status = 'PENDIENTE' 
      AND p.concept IN ('EXTRA_HOUR', 'PERSONA_EXTRA', 'DAMAGE_CHARGE', 'ESTANCIA', 'RENEWAL') 
      AND p.parent_payment_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM sales_order_items soi
        WHERE soi.sales_order_id = p.sales_order_id 
          AND soi.is_paid = false 
          AND (
            (p.concept = 'EXTRA_HOUR' AND soi.concept_type = 'EXTRA_HOUR') OR 
            (p.concept = 'PERSONA_EXTRA' AND soi.concept_type = 'EXTRA_PERSON') OR
            (p.concept = 'DAMAGE_CHARGE' AND soi.concept_type = 'DAMAGE_CHARGE') OR
            (p.concept = 'ESTANCIA' AND soi.concept_type = 'ROOM_BASE') OR
            (p.concept = 'RENEWAL' AND soi.concept_type = 'RENEWAL')
          )
      )
  LOOP
    -- 1. Cancel the orphaned payment
    UPDATE payments SET status = 'CANCELADO' WHERE id = v_rec.id;

    -- 2. Update the sales order totals
    UPDATE sales_orders
    SET 
      subtotal = GREATEST(0, subtotal - v_rec.amount),
      total = GREATEST(0, total - v_rec.amount),
      remaining_amount = GREATEST(0, remaining_amount - v_rec.amount)
    WHERE id = v_rec.sales_order_id;
    
    RAISE NOTICE 'Cancelled orphaned payment % for order % (amount %)', v_rec.id, v_rec.sales_order_id, v_rec.amount;
  END LOOP;
END;
$$;

-- Update notifications_type_check to include 'chat_message'
DO $$ 
BEGIN
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'stock_low', 'stock_critical', 'order_pending', 'payment_due', 
      'shift_started', 'shift_ended', 'system_alert', 'info',
      'NEW_EXTRA', 'NEW_CONSUMPTION', 'DAMAGE_REPORT', 'PROMO_4H', 'ROOM_CHANGE', 'NEW_ENTRY',
      'chat_message'
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint update skipped or failed: %', SQLERRM;
END $$;

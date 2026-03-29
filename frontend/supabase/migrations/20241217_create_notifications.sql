-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'stock_low',
    'stock_critical',
    'order_pending',
    'payment_due',
    'shift_started',
    'shift_ended',
    'system_alert',
    'info'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Create indexes for better query performance
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read) WHERE NOT is_archived;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_employee ON notifications(employee_id);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications or notifications for their employee_id
CREATE POLICY notifications_select_policy ON notifications
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR 
    employee_id IN (
      SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Only authenticated users can insert notifications (for system-generated ones)
CREATE POLICY notifications_insert_policy ON notifications
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update their own notifications (mark as read, archived)
CREATE POLICY notifications_update_policy ON notifications
  FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR 
    employee_id IN (
      SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own notifications
CREATE POLICY notifications_delete_policy ON notifications
  FOR DELETE
  USING (
    auth.uid() = user_id 
    OR 
    employee_id IN (
      SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

-- Function to automatically create stock low notifications
CREATE OR REPLACE FUNCTION check_low_stock_and_notify()
RETURNS TRIGGER AS $$
DECLARE
  product_record RECORD;
  total_stock NUMERIC;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get product details
  SELECT p.*, p.min_stock 
  INTO product_record
  FROM products p
  WHERE p.id = NEW.product_id;

  -- Calculate total stock across all warehouses
  SELECT COALESCE(SUM(qty), 0)
  INTO total_stock
  FROM stock
  WHERE product_id = NEW.product_id;

  -- Check if stock is below minimum
  IF total_stock <= product_record.min_stock AND total_stock > 0 THEN
    notification_title := 'Stock Bajo: ' || product_record.name;
    notification_message := 'El producto ' || product_record.name || ' tiene stock bajo (' || total_stock || ' unidades). Mínimo: ' || product_record.min_stock;
    
    -- Create notification for all admin users
    INSERT INTO notifications (user_id, type, title, message, data, action_url)
    SELECT 
      e.auth_user_id,
      'stock_low',
      notification_title,
      notification_message,
      jsonb_build_object(
        'product_id', product_record.id,
        'product_name', product_record.name,
        'current_stock', total_stock,
        'min_stock', product_record.min_stock
      ),
      '/products/' || product_record.id
    FROM employees e
    WHERE e.role IN ('admin', 'manager') AND e.auth_user_id IS NOT NULL;
    
  ELSIF total_stock = 0 THEN
    notification_title := 'Stock Crítico: ' || product_record.name;
    notification_message := 'URGENTE: El producto ' || product_record.name || ' está agotado';
    
    -- Create critical notification
    INSERT INTO notifications (user_id, type, title, message, data, action_url)
    SELECT 
      e.auth_user_id,
      'stock_critical',
      notification_title,
      notification_message,
      jsonb_build_object(
        'product_id', product_record.id,
        'product_name', product_record.name,
        'current_stock', 0
      ),
      '/products/' || product_record.id
    FROM employees e
    WHERE e.role IN ('admin', 'manager') AND e.auth_user_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to check stock after inventory movements
CREATE TRIGGER trigger_check_low_stock
AFTER INSERT OR UPDATE OF qty ON stock
FOR EACH ROW
EXECUTE FUNCTION check_low_stock_and_notify();

-- Function to clean up old notifications (older than 30 days and archived)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE is_archived = true 
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE notifications IS 'System notifications for users about important events';
COMMENT ON COLUMN notifications.type IS 'Type of notification: stock_low, stock_critical, order_pending, payment_due, etc.';
COMMENT ON COLUMN notifications.data IS 'Additional JSON data specific to the notification type';
COMMENT ON COLUMN notifications.action_url IS 'Optional URL to navigate when notification is clicked';

-- Performance indexes for frequently queried columns
-- These columns are queried on nearly every page load and room operation

-- employees.auth_user_id: queried on every page load to get current employee
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id ON employees(auth_user_id);

-- room_stays.status: queried on every room operation (ACTIVA stays)
CREATE INDEX IF NOT EXISTS idx_room_stays_status ON room_stays(status);

-- room_stays.sales_order_id: queried for payment processing
CREATE INDEX IF NOT EXISTS idx_room_stays_sales_order_id ON room_stays(sales_order_id);

-- shift_sessions.status + clock_out_at: queried for active shift detection
CREATE INDEX IF NOT EXISTS idx_shift_sessions_active ON shift_sessions(status, clock_out_at) WHERE status = 'active';

-- sales_order_items.sales_order_id: queried for order item details
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order_id ON sales_order_items(sales_order_id);

-- push_subscriptions.employee_id: queried for push notification delivery
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_employee_id ON push_subscriptions(employee_id);

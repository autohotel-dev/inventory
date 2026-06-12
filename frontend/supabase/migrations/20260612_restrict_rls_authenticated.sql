-- ================================================================
-- FIX: Restrict RLS policies to authenticated users only
-- Description: Replace overly permissive USING (true) policies
--              with policies that require authentication
-- ================================================================

-- 1. ROOMS - authenticated users only
DROP POLICY IF EXISTS "Enable read access for all users" ON rooms;
CREATE POLICY "Authenticated users can read rooms" ON rooms
    FOR SELECT
    TO authenticated
    USING (true);

-- 2. ROOM_STAYS - authenticated users only
DROP POLICY IF EXISTS "Enable read access for all users" ON room_stays;
CREATE POLICY "Authenticated users can read room_stays" ON room_stays
    FOR SELECT
    TO authenticated
    USING (true);

-- 3. PAYMENTS - authenticated users only
DROP POLICY IF EXISTS "Enable read access for all users" ON payments;
CREATE POLICY "Authenticated users can read payments" ON payments
    FOR SELECT
    TO authenticated
    USING (true);

-- 4. SALES_ORDERS - authenticated users only
DROP POLICY IF EXISTS "Enable read access for all users" ON sales_orders;
CREATE POLICY "Authenticated users can read sales_orders" ON sales_orders
    FOR SELECT
    TO authenticated
    USING (true);

-- 5. SALES_ORDER_ITEMS - authenticated users only
DROP POLICY IF EXISTS "Enable read access for all users" ON sales_order_items;
CREATE POLICY "Authenticated users can read sales_order_items" ON sales_order_items
    FOR SELECT
    TO authenticated
    USING (true);

-- 6. EMPLOYEES - authenticated users only
DROP POLICY IF EXISTS "Enable read access for all users" ON employees;
CREATE POLICY "Authenticated users can read employees" ON employees
    FOR SELECT
    TO authenticated
    USING (true);

-- 7. SHIFT_SESSIONS - authenticated users only
DROP POLICY IF EXISTS "Enable read access for all users" ON shift_sessions;
CREATE POLICY "Authenticated users can read shift_sessions" ON shift_sessions
    FOR SELECT
    TO authenticated
    USING (true);

-- 8. NOTIFICATIONS - authenticated users only
DROP POLICY IF EXISTS "Enable read access for all users" ON notifications;
CREATE POLICY "Authenticated users can read notifications" ON notifications
    FOR SELECT
    TO authenticated
    USING (true);

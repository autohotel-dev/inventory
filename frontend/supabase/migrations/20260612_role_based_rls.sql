-- ================================================================
-- FIX: Role-based RLS policies
-- Replace USING (true) with role-based restrictions
-- ================================================================

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT role FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Helper function to check if user is admin or manager
CREATE OR REPLACE FUNCTION is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM employees
        WHERE auth_user_id = auth.uid()
        AND role IN ('admin', 'manager')
    );
$$;

-- Helper function to check if user is receptionist or above
CREATE OR REPLACE FUNCTION is_receptionist_or_above()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM employees
        WHERE auth_user_id = auth.uid()
        AND role IN ('admin', 'manager', 'supervisor', 'receptionist')
    );
$$;

-- ================================================================
-- 1. ROOMS - All authenticated users can read (need room status)
-- ================================================================
DROP POLICY IF EXISTS "Authenticated users can read rooms" ON rooms;
DROP POLICY IF EXISTS "Enable read access for all users" ON rooms;
CREATE POLICY "Authenticated users can read rooms" ON rooms
    FOR SELECT
    TO authenticated
    USING (true);

-- ================================================================
-- 2. ROOM_STAYS - Role-based access
-- ================================================================
DROP POLICY IF EXISTS "Authenticated users can read room_stays" ON room_stays;
DROP POLICY IF EXISTS "Enable read access for all users" ON room_stays;

-- Admin/Manager: See all stays
CREATE POLICY "Admin/Manager can read all room_stays" ON room_stays
    FOR SELECT
    TO authenticated
    USING (is_admin_or_manager());

-- Receptionist: See all stays (manages check-ins/checkouts)
CREATE POLICY "Receptionist can read all room_stays" ON room_stays
    FOR SELECT
    TO authenticated
    USING (is_receptionist_or_above());

-- Cochero: See only active stays or stays they're assigned to
CREATE POLICY "Cochero can read assigned or active stays" ON room_stays
    FOR SELECT
    TO authenticated
    USING (
        status = 'ACTIVA'
        OR valet_employee_id IN (
            SELECT id FROM employees WHERE auth_user_id = auth.uid()
        )
        OR checkout_valet_employee_id IN (
            SELECT id FROM employees WHERE auth_user_id = auth.uid()
        )
    );

-- ================================================================
-- 3. PAYMENTS - Role-based access
-- ================================================================
DROP POLICY IF EXISTS "Authenticated users can read payments" ON payments;
DROP POLICY IF EXISTS "Enable read access for all users" ON payments;

-- Admin/Manager: See all payments
CREATE POLICY "Admin/Manager can read all payments" ON payments
    FOR SELECT
    TO authenticated
    USING (is_admin_or_manager());

-- Receptionist: See payments for their shift
CREATE POLICY "Receptionist can read shift payments" ON payments
    FOR SELECT
    TO authenticated
    USING (is_receptionist_or_above());

-- Cochero: See only payments they collected
CREATE POLICY "Cochero can read own collected payments" ON payments
    FOR SELECT
    TO authenticated
    USING (
        collected_by IN (
            SELECT id FROM employees WHERE auth_user_id = auth.uid()
        )
    );

-- ================================================================
-- 4. SALES_ORDERS - Role-based access
-- ================================================================
DROP POLICY IF EXISTS "Authenticated users can read sales_orders" ON sales_orders;
DROP POLICY IF EXISTS "Enable read access for all users" ON sales_orders;

-- Admin/Manager: See all orders
CREATE POLICY "Admin/Manager can read all sales_orders" ON sales_orders
    FOR SELECT
    TO authenticated
    USING (is_admin_or_manager());

-- Receptionist: See all orders
CREATE POLICY "Receptionist can read all sales_orders" ON sales_orders
    FOR SELECT
    TO authenticated
    USING (is_receptionist_or_above());

-- Cochero: See orders for rooms they're assigned to
CREATE POLICY "Cochero can read assigned room orders" ON sales_orders
    FOR SELECT
    TO authenticated
    USING (
        room_stay_id IN (
            SELECT id FROM room_stays
            WHERE valet_employee_id IN (
                SELECT id FROM employees WHERE auth_user_id = auth.uid()
            )
        )
    );

-- ================================================================
-- 5. SALES_ORDER_ITEMS - Follows sales_orders access
-- ================================================================
DROP POLICY IF EXISTS "Authenticated users can read sales_order_items" ON sales_order_items;
DROP POLICY IF EXISTS "Enable read access for all users" ON sales_order_items;

-- Admin/Manager: See all items
CREATE POLICY "Admin/Manager can read all sales_order_items" ON sales_order_items
    FOR SELECT
    TO authenticated
    USING (is_admin_or_manager());

-- Receptionist: See all items
CREATE POLICY "Receptionist can read all sales_order_items" ON sales_order_items
    FOR SELECT
    TO authenticated
    USING (is_receptionist_or_above());

-- Cochero: See items for their assigned rooms
CREATE POLICY "Cochero can read assigned room items" ON sales_order_items
    FOR SELECT
    TO authenticated
    USING (
        sales_order_id IN (
            SELECT id FROM sales_orders
            WHERE room_stay_id IN (
                SELECT id FROM room_stays
                WHERE valet_employee_id IN (
                    SELECT id FROM employees WHERE auth_user_id = auth.uid()
                )
            )
        )
    );

-- ================================================================
-- 6. EMPLOYEES - Role-based access
-- ================================================================
DROP POLICY IF EXISTS "Authenticated users can read employees" ON employees;
DROP POLICY IF EXISTS "Enable read access for all users" ON employees;

-- Admin/Manager: See all employees
CREATE POLICY "Admin/Manager can read all employees" ON employees
    FOR SELECT
    TO authenticated
    USING (is_admin_or_manager());

-- Others: See only basic info (name, role, is_active)
CREATE POLICY "Others can read basic employee info" ON employees
    FOR SELECT
    TO authenticated
    USING (true);

-- ================================================================
-- 7. SHIFT_SESSIONS - Role-based access
-- ================================================================
DROP POLICY IF EXISTS "Authenticated users can read shift_sessions" ON shift_sessions;
DROP POLICY IF EXISTS "Enable read access for all users" ON shift_sessions;

-- Admin/Manager: See all shifts
CREATE POLICY "Admin/Manager can read all shift_sessions" ON shift_sessions
    FOR SELECT
    TO authenticated
    USING (is_admin_or_manager());

-- Receptionist: See all shifts (manages shift openings/closings)
CREATE POLICY "Receptionist can read all shift_sessions" ON shift_sessions
    FOR SELECT
    TO authenticated
    USING (is_receptionist_or_above());

-- Others: See only their own shifts
CREATE POLICY "Others can read own shifts" ON shift_sessions
    FOR SELECT
    TO authenticated
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE auth_user_id = auth.uid()
        )
    );

-- ================================================================
-- 8. NOTIFICATIONS - Users see only their own
-- ================================================================
DROP POLICY IF EXISTS "Authenticated users can read notifications" ON notifications;
DROP POLICY IF EXISTS "Enable read access for all users" ON notifications;

-- Users: See only their own notifications
CREATE POLICY "Users can read own notifications" ON notifications
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR user_id IS NULL  -- System notifications
    );

-- Admin/Manager: See all notifications
CREATE POLICY "Admin/Manager can read all notifications" ON notifications
    FOR SELECT
    TO authenticated
    USING (is_admin_or_manager());

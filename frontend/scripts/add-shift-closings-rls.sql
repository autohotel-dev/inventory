-- =====================================================
-- ROW LEVEL SECURITY POLICIES FOR SHIFT CLOSINGS
-- =====================================================
-- Este script implementa políticas de seguridad a nivel de fila
-- para proteger el módulo de cortes de caja

-- =====================================================
-- 1. POLÍTICAS PARA SHIFT_CLOSINGS
-- =====================================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view their own closings" ON shift_closings;
DROP POLICY IF EXISTS "Admins can view all closings" ON shift_closings;
DROP POLICY IF EXISTS "Users can create their own closings" ON shift_closings;
DROP POLICY IF EXISTS "Only admins can approve or reject closings" ON shift_closings;
DROP POLICY IF EXISTS "Only admins can delete closings" ON shift_closings;

-- Política de lectura: Empleados ven solo sus cortes, admins/managers ven todos
CREATE POLICY "Users can view their own closings" ON shift_closings
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM employees 
    WHERE auth_user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- Política de inserción: Solo pueden crear cortes para su propia sesión
CREATE POLICY "Users can create their own closings" ON shift_closings
FOR INSERT
WITH CHECK (
  employee_id IN (
    SELECT id FROM employees 
    WHERE auth_user_id = auth.uid()
  )
);

-- Política de actualización: Solo admins/managers pueden aprobar o rechazar
CREATE POLICY "Only admins can approve or reject closings" ON shift_closings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- Política de eliminación: Solo admins pueden eliminar
CREATE POLICY "Only admins can delete closings" ON shift_closings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- =====================================================
-- 2. POLÍTICAS PARA SHIFT_CLOSING_DETAILS
-- =====================================================

DROP POLICY IF EXISTS "Users can view closing details" ON shift_closing_details;
DROP POLICY IF EXISTS "Users can create closing details" ON shift_closing_details;

-- Los detalles se pueden ver si el corte es visible para el usuario
CREATE POLICY "Users can view closing details" ON shift_closing_details
FOR SELECT
USING (
  shift_closing_id IN (
    SELECT id FROM shift_closings 
    WHERE employee_id IN (
      SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- Los detalles solo se pueden crear si el corte pertenece al usuario
CREATE POLICY "Users can create closing details" ON shift_closing_details
FOR INSERT
WITH CHECK (
  shift_closing_id IN (
    SELECT id FROM shift_closings 
    WHERE employee_id IN (
      SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
  )
);

-- =====================================================
-- 3. POLÍTICAS PARA SHIFT_CLOSING_REVIEWS
-- =====================================================

DROP POLICY IF EXISTS "Allow read shift_closing_reviews" ON shift_closing_reviews;
DROP POLICY IF EXISTS "Allow insert shift_closing_reviews for admins" ON shift_closing_reviews;

-- Todos pueden leer las revisiones de cortes que pueden ver
CREATE POLICY "Anyone can view reviews" ON shift_closing_reviews
FOR SELECT
USING (
  shift_closing_id IN (
    SELECT id FROM shift_closings 
    WHERE employee_id IN (
      SELECT id FROM employees WHERE auth_user_id = auth.uid()
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- Solo admins/managers pueden crear revisiones
CREATE POLICY "Only admins can create reviews" ON shift_closing_reviews
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- =====================================================
-- 4. VERIFICACIÓN DE POLÍTICAS
-- =====================================================

-- Verificar que RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('shift_closings', 'shift_closing_details', 'shift_closing_reviews');

-- Listar todas las políticas creadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('shift_closings', 'shift_closing_details', 'shift_closing_reviews')
ORDER BY tablename, policyname;

-- =====================================================
-- 5. NOTA IMPORTANTE
-- =====================================================
-- DESPUÉS DE EJECUTAR ESTE SCRIPT:
-- 1. Verificar que las políticas están activas
-- 2. Probar acceso con usuario normal (debe ver solo sus cortes)
-- 3. Probar acceso con admin (debe ver todos los cortes)
-- 4. Probar creación de cortes (solo propios)
-- 5. Probar aprobación/rechazo (solo admins)

-- =====================================================
-- VINCULAR EMPLEADOS CON SUPABASE AUTH (MÁS SEGURO)
-- =====================================================
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna auth_user_id a employees
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Crear índice único para auth_user_id (un usuario solo puede ser un empleado)
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_auth_user_id 
ON employees(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 3. Comentario
COMMENT ON COLUMN employees.auth_user_id IS 'UUID del usuario en Supabase Auth para vinculación segura';

-- 4. Función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  role VARCHAR(20),
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as employee_id,
    (e.first_name || ' ' || e.last_name)::TEXT as employee_name,
    e.role,
    e.is_active
  FROM employees e
  WHERE e.auth_user_id = auth.uid()
    AND e.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Función para vincular usuario actual con empleado (por email)
CREATE OR REPLACE FUNCTION link_current_user_to_employee()
RETURNS BOOLEAN AS $$
DECLARE
  v_user_email TEXT;
  v_employee_id UUID;
BEGIN
  -- Obtener email del usuario actual
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  IF v_user_email IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Buscar empleado con ese email que no tenga auth_user_id
  SELECT id INTO v_employee_id 
  FROM employees 
  WHERE email = v_user_email 
    AND auth_user_id IS NULL
    AND is_active = true
  LIMIT 1;
  
  IF v_employee_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Vincular
  UPDATE employees 
  SET auth_user_id = auth.uid()
  WHERE id = v_employee_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Política RLS mejorada para employees (opcional, si quieres más seguridad)
-- Los empleados solo pueden ver su propio registro, admins ven todo
-- DROP POLICY IF EXISTS "Employees can view own record" ON employees;
-- CREATE POLICY "Employees can view own record" ON employees
--   FOR SELECT USING (
--     auth_user_id = auth.uid() 
--     OR 
--     EXISTS (
--       SELECT 1 FROM employees e 
--       WHERE e.auth_user_id = auth.uid() 
--       AND e.role IN ('admin', 'manager')
--     )
--     OR
--     NOT EXISTS (SELECT 1 FROM employees WHERE auth_user_id = auth.uid())
--   );

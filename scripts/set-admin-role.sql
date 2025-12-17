-- Script para establecer rol de admin para el usuario hackminor@live.com.mx
-- Ejecutar en Supabase SQL Editor

-- Opción 1: Por email
UPDATE employees 
SET role = 'admin' 
WHERE email = 'hackminor@live.com.mx';

-- Opción 2: Si el email no coincide, buscar por user_id del auth
-- Primero encontrar el user_id en auth.users y luego actualizar
UPDATE employees 
SET role = 'admin' 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'hackminor@live.com.mx'
);

-- Verificar el cambio
SELECT id, first_name, last_name, email, role, user_id 
FROM employees 
WHERE email = 'hackminor@live.com.mx' 
   OR user_id IN (SELECT id FROM auth.users WHERE email = 'hackminor@live.com.mx');

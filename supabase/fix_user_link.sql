-- Script to link Auth Users to Employees and Fix Login Issues
-- Run this in Supabase SQL Editor

-- 1. Check for unlinked employees
SELECT * FROM employees WHERE auth_user_id IS NULL;

-- 2. Link employee by email (Replace 'EMAIL_HERE' with the receptionist's email)
-- This assumes the email in 'employees' matches the email in 'auth.users'
UPDATE employees
SET auth_user_id = (SELECT id FROM auth.users WHERE email = employees.email)
WHERE auth_user_id IS NULL
AND email IN (SELECT email FROM auth.users);

-- 3. Verify the link
SELECT e.first_name, e.last_name, e.role, u.email 
FROM employees e
JOIN auth.users u ON e.auth_user_id = u.id
WHERE e.role = 'receptionist';

-- 4. (Optional) Force create an employee record if it doesn't exist for a user
-- Replace 'USER_EMAIL' with the actual email
/*
INSERT INTO employees (first_name, last_name, email, role, business_id, is_active, auth_user_id)
SELECT 
  'Recepcionista' as first_name,
  'User' as last_name,
  email,
  'receptionist' as role,
  (SELECT id FROM business_units LIMIT 1) as business_id, -- assuming business_units exists
  true as is_active,
  id as auth_user_id
FROM auth.users
WHERE email = 'USER_EMAIL'
AND NOT EXISTS (SELECT 1 FROM employees WHERE email = 'USER_EMAIL');
*/

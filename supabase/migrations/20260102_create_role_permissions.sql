-- Migration: Create role_permissions table for dynamic permission management
-- Created: 2026-01-02
-- Description: Adds support for dynamic role-based permissions for menus and pages

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'receptionist', 'cochero')),
  resource VARCHAR(100) NOT NULL, -- e.g., 'menu.dashboard', 'page.products'
  permission_type VARCHAR(50) NOT NULL CHECK (permission_type IN ('menu', 'page')),
  allowed BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}', -- Additional configuration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_role_resource UNIQUE(role, resource)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_resource ON role_permissions(resource);
CREATE INDEX IF NOT EXISTS idx_role_permissions_type ON role_permissions(permission_type);

-- Enable RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can do everything
CREATE POLICY "Admins can manage all permissions"
  ON role_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.auth_user_id = auth.uid()
      AND employees.role IN ('admin', 'manager')
      AND employees.is_active = true
    )
  );

-- All authenticated users can read permissions for their own role
CREATE POLICY "Users can read their role permissions"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (
    role IN (
      SELECT employees.role FROM employees
      WHERE employees.auth_user_id = auth.uid()
      AND employees.is_active = true
    )
    OR
    -- Allow reading if user is not linked to employee (defaults to admin)
    NOT EXISTS (
      SELECT 1 FROM employees
      WHERE employees.auth_user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_role_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_role_permissions_updated_at();

-- Seed initial permissions based on current configuration
-- Cochero permissions (Dashboard + Habitaciones POS)
INSERT INTO role_permissions (role, resource, permission_type, allowed) VALUES
  ('cochero', 'menu.dashboard', 'menu', true),
  ('cochero', 'menu.sales.pos', 'menu', true),
  ('cochero', 'page./dashboard', 'page', true),
  ('cochero', 'page./sales/pos', 'page', true)
ON CONFLICT (role, resource) DO NOTHING;

-- Recepcionista permissions (Dashboard + Habitaciones POS + Cortes de Caja + Reporte de Ingresos + Capacitación)
INSERT INTO role_permissions (role, resource, permission_type, allowed) VALUES
  ('receptionist', 'menu.dashboard', 'menu', true),
  ('receptionist', 'menu.sales.pos', 'menu', true),
  ('receptionist', 'menu.employees.closings', 'menu', true),
  ('receptionist', 'menu.reports.income', 'menu', true),
  ('receptionist', 'menu.training', 'menu', true),
  ('receptionist', 'page./dashboard', 'page', true),
  ('receptionist', 'page./sales/pos', 'page', true),
  ('receptionist', 'page./employees/closings', 'page', true),
  ('receptionist', 'page./reports/income', 'page', true),
  ('receptionist', 'page./training', 'page', true)
ON CONFLICT (role, resource) DO NOTHING;

-- Manager permissions (all menu items)
INSERT INTO role_permissions (role, resource, permission_type, allowed) VALUES
  ('manager', 'menu.dashboard', 'menu', true),
  ('manager', 'menu.products', 'menu', true),
  ('manager', 'menu.categories', 'menu', true),
  ('manager', 'menu.warehouses', 'menu', true),
  ('manager', 'menu.suppliers', 'menu', true),
  ('manager', 'menu.customers', 'menu', true),
  ('manager', 'menu.notifications-admin', 'menu', true),
  ('manager', 'menu.movements', 'menu', true),
  ('manager', 'menu.stock', 'menu', true),
  ('manager', 'menu.kardex', 'menu', true),
  ('manager', 'menu.analytics', 'menu', true),
  ('manager', 'menu.export', 'menu', true),
  ('manager', 'menu.purchases-sales', 'menu', true),
  ('manager', 'menu.purchases', 'menu', true),
  ('manager', 'menu.sales', 'menu', true),
  ('manager', 'menu.sales.pos', 'menu', true),
  ('manager', 'menu.sensors', 'menu', true),
  ('manager', 'menu.employees', 'menu', true),
  ('manager', 'menu.employees.schedules', 'menu', true),
  ('manager', 'menu.employees.closings', 'menu', true),
  ('manager', 'menu.reports.income', 'menu', true),
  ('manager', 'menu.training', 'menu', true),
  ('manager', 'menu.settings', 'menu', true),
  ('manager', 'menu.settings.media', 'menu', true),
  ('manager', 'menu.settings.permissions', 'menu', true)
ON CONFLICT (role, resource) DO NOTHING;

-- Admin permissions (all menu items - same as manager)
INSERT INTO role_permissions (role, resource, permission_type, allowed) VALUES
  ('admin', 'menu.dashboard', 'menu', true),
  ('admin', 'menu.products', 'menu', true),
  ('admin', 'menu.categories', 'menu', true),
  ('admin', 'menu.warehouses', 'menu', true),
  ('admin', 'menu.suppliers', 'menu', true),
  ('admin', 'menu.customers', 'menu', true),
  ('admin', 'menu.notifications-admin', 'menu', true),
  ('admin', 'menu.movements', 'menu', true),
  ('admin', 'menu.stock', 'menu', true),
  ('admin', 'menu.kardex', 'menu', true),
  ('admin', 'menu.analytics', 'menu', true),
  ('admin', 'menu.export', 'menu', true),
  ('admin', 'menu.purchases-sales', 'menu', true),
  ('admin', 'menu.purchases', 'menu', true),
  ('admin', 'menu.sales', 'menu', true),
  ('admin', 'menu.sales.pos', 'menu', true),
  ('admin', 'menu.sensors', 'menu', true),
  ('admin', 'menu.employees', 'menu', true),
  ('admin', 'menu.employees.schedules', 'menu', true),
  ('admin', 'menu.employees.closings', 'menu', true),
  ('admin', 'menu.reports.income', 'menu', true),
  ('admin', 'menu.training', 'menu', true),
  ('admin', 'menu.settings', 'menu', true),
  ('admin', 'menu.settings.media', 'menu', true),
  ('admin', 'menu.settings.permissions', 'menu', true)
ON CONFLICT (role, resource) DO NOTHING;

-- Add corresponding page permissions for all roles
-- (This ensures users can access pages even if they navigate directly)
INSERT INTO role_permissions (role, resource, permission_type, allowed)
SELECT 
  role,
  REPLACE(resource, 'menu.', 'page./'),
  'page',
  allowed
FROM role_permissions
WHERE permission_type = 'menu'
ON CONFLICT (role, resource) DO NOTHING;

-- Add comment to table
COMMENT ON TABLE role_permissions IS 'Stores dynamic role-based permissions for menu and page access control';
COMMENT ON COLUMN role_permissions.role IS 'User role: admin, manager, receptionist, or cochero';
COMMENT ON COLUMN role_permissions.resource IS 'Resource identifier (e.g., menu.dashboard, page./products)';
COMMENT ON COLUMN role_permissions.permission_type IS 'Type of permission: menu or page';
COMMENT ON COLUMN role_permissions.allowed IS 'Whether the role has access to this resource';
COMMENT ON COLUMN role_permissions.metadata IS 'Additional configuration in JSON format';

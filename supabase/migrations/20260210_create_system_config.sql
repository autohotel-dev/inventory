-- Shared business configuration (singleton row)
-- Stores settings that need to be shared across all devices/browsers

CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initial_cash_fund DECIMAL(10,2) NOT NULL DEFAULT 500,
  valet_advance_amount DECIMAL(10,2) NOT NULL DEFAULT 300,
  include_global_sales_in_shift BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Seed with default values (singleton)
INSERT INTO system_config (initial_cash_fund, valet_advance_amount, include_global_sales_in_shift)
VALUES (500, 300, TRUE)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Policy: Any authenticated user can read config
CREATE POLICY "Allow authenticated read system config" ON system_config
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only admins can modify config
CREATE POLICY "Only admins can modify system config" ON system_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.auth_user_id = auth.uid()
      AND employees.role IN ('admin', 'gerente', 'Administrador')
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_system_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_config_updated_at
  BEFORE UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION update_system_config_timestamp();

COMMENT ON TABLE system_config IS 'Shared business configuration (singleton). Settings here apply to all devices.';
COMMENT ON COLUMN system_config.initial_cash_fund IS 'Fondo de caja inicial para cada turno de recepción';
COMMENT ON COLUMN system_config.valet_advance_amount IS 'Adelanto en efectivo por cada cochero en turno';
COMMENT ON COLUMN system_config.include_global_sales_in_shift IS 'Si incluye ventas de Admin/Otros en el reporte de turno';

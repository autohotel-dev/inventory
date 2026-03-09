-- FIX #12: Database-driven pricing configuration
-- Allows admins to modify promo pricing without code deployment

CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_type_name TEXT NOT NULL,
  promo_type TEXT NOT NULL CHECK (promo_type IN ('4H_PROMO', 'WEEKEND', 'MONTHLY', 'CUSTOM')),
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(room_type_name, promo_type)
);

-- Seed initial 4-hour promo pricing
INSERT INTO pricing_config (room_type_name, promo_type, price, description) VALUES
  ('Alberca', '4H_PROMO', 1000, 'Promoción 4 horas - Alberca'),
  ('Jacuzzi y Sauna', '4H_PROMO', 600, 'Promoción 4 horas - Jacuzzi y Sauna'),
  ('Jacuzzi', '4H_PROMO', 440, 'Promoción 4 horas - Jacuzzi'),
  ('Sencilla', '4H_PROMO', 300, 'Promoción 4 horas - Sencilla'),
  ('Torre', '4H_PROMO', 270, 'Promoción 4 horas - Torre')
ON CONFLICT (room_type_name, promo_type) DO NOTHING;

-- Enable RLS
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active pricing
CREATE POLICY "Allow read active pricing" ON pricing_config
  FOR SELECT 
  USING (is_active = true);

-- Policy: Only authenticated users can read all pricing
CREATE POLICY "Allow authenticated read all pricing" ON pricing_config
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Policy: Only admins can insert/update/delete pricing
CREATE POLICY "Only admins can modify pricing" ON pricing_config
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.auth_user_id = auth.uid() 
      AND employees.role IN ('admin', 'gerente', 'Administrador')
    )
  );

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pricing_config_active 
ON pricing_config(room_type_name, promo_type) 
WHERE is_active = true;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_pricing_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pricing_config_updated_at
  BEFORE UPDATE ON pricing_config
  FOR EACH ROW
  EXECUTE FUNCTION update_pricing_config_timestamp();

COMMENT ON TABLE pricing_config IS 'Dynamic pricing configuration for room promotions';
COMMENT ON COLUMN pricing_config.promo_type IS 'Type of promotion: 4H_PROMO, WEEKEND, MONTHLY, CUSTOM';
COMMENT ON COLUMN pricing_config.room_type_name IS 'Must match room_types.name exactly';

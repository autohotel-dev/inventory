-- Create bottle_package_rules table for configurable drink inclusion
CREATE TABLE IF NOT EXISTS bottle_package_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_type TEXT NOT NULL,                          -- PZBOT, PZBOTAN
  subcategory_id UUID REFERENCES subcategories(id) ON DELETE CASCADE,
  included_category_id UUID NOT NULL REFERENCES categories(id), -- Refrescos or Jugos
  quantity INTEGER NOT NULL DEFAULT 0,              -- Configurable quantity
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_type, subcategory_id)
);

-- Enable RLS
ALTER TABLE bottle_package_rules ENABLE ROW LEVEL SECURITY;

-- Policy for reading (all authenticated users)
CREATE POLICY "Allow read for authenticated users"
  ON bottle_package_rules FOR SELECT
  TO authenticated
  USING (true);

-- Policy for modifications (only admins)
CREATE POLICY "Allow modifications for service role"
  ON bottle_package_rules FOR ALL
  TO service_role
  USING (true);

-- Add indexes for performance
CREATE INDEX idx_bottle_package_rules_unit ON bottle_package_rules(unit_type);
CREATE INDEX idx_bottle_package_rules_subcategory ON bottle_package_rules(subcategory_id);
CREATE INDEX idx_bottle_package_rules_active ON bottle_package_rules(is_active) WHERE is_active = true;

-- Insert default rules (these can be edited via admin UI)
-- Note: You'll need to insert the actual subcategory UUIDs from your database

-- COMMENT: After migration, insert rules with actual subcategory IDs:
-- INSERT INTO bottle_package_rules (unit_type, subcategory_id, included_category_id, quantity)
-- VALUES 
--   ('PZBOT', 'normal-subcategory-id', '233bd65d-9bb6-48e0-a956-0bb971ad24bc', 5),
--   ('PZBOT', 'vodka-subcategory-id', '58226037-829e-491c-8c11-5d7ae7b31f78', 3),
--   ('PZBOTAN', 'normal-subcategory-id', '233bd65d-9bb6-48e0-a956-0bb971ad24bc', 2),
--   ('PZBOTAN', 'vodka-subcategory-id', '58226037-829e-491c-8c11-5d7ae7b31f78', 1);

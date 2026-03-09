-- =============================================================
-- Tabla: product_promotions
-- Promociones de productos: NxM (2x1), % descuento, precio fijo
-- =============================================================

CREATE TABLE IF NOT EXISTS product_promotions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                          -- "2x1 Cervezas", "20% Refrescos"
  promo_type TEXT NOT NULL CHECK (promo_type IN ('NxM', 'PERCENT_DISCOUNT', 'FIXED_PRICE')),

  -- NxM: Compra buy_quantity, paga pay_quantity
  buy_quantity INT,                            -- N (ej. 2 para 2x1)
  pay_quantity INT,                            -- M (ej. 1 para 2x1)

  -- PERCENT_DISCOUNT
  discount_percent NUMERIC,                    -- 0-100

  -- FIXED_PRICE
  fixed_price NUMERIC,                         -- Precio especial

  -- Alcance: por producto específico O por categoría/subcategoría
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  subcategory_id UUID REFERENCES subcategories(id) ON DELETE CASCADE,

  -- Vigencia
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ,                      -- NULL = sin fecha inicio
  end_date TIMESTAMPTZ,                        -- NULL = sin fecha fin

  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_product_promotions_active ON product_promotions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_promotions_product ON product_promotions(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_promotions_category ON product_promotions(category_id) WHERE category_id IS NOT NULL;

-- RLS
ALTER TABLE product_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read promotions"
  ON product_promotions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert promotions"
  ON product_promotions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update promotions"
  ON product_promotions FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete promotions"
  ON product_promotions FOR DELETE
  TO authenticated
  USING (true);

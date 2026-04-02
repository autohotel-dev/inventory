-- Migración para añadir soporte de subcategorías
-- Fecha: 2026-01-23

-- 1. Crear tabla de subcategorías
CREATE TABLE IF NOT EXISTS subcategories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category_id, name)
);

-- 2. Añadir columna subcategory_id a products
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL;

-- 3. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_active ON subcategories(is_active);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory_id);

-- 4. Crear trigger para updated_at en subcategories
DROP TRIGGER IF EXISTS update_subcategories_updated_at ON subcategories;
CREATE TRIGGER update_subcategories_updated_at 
    BEFORE UPDATE ON subcategories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Comentarios en las columnas
COMMENT ON TABLE subcategories IS 'Subcategorías de productos, relacionadas con categorías principales';
COMMENT ON COLUMN subcategories.category_id IS 'Categoría padre a la que pertenece esta subcategoría';
COMMENT ON COLUMN products.subcategory_id IS 'Subcategoría opcional del producto';

-- 6. Habilitar RLS si está habilitado en otras tablas
-- ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all operations for authenticated users" ON subcategories FOR ALL TO authenticated USING (true);

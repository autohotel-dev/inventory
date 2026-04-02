-- Script para configurar las tablas del sistema de inventario
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Crear tabla de categorías
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Para colores hex #FFFFFF
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear tabla de proveedores
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  contact_person VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Crear/actualizar tabla de productos
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sku VARCHAR(50) UNIQUE NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  category_id UUID REFERENCES categories(id),
  supplier_id UUID REFERENCES suppliers(id),
  barcode VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Crear tabla de movimientos de inventario
CREATE TABLE IF NOT EXISTS movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) NOT NULL,
  type VARCHAR(20) CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT')) NOT NULL,
  quantity INTEGER NOT NULL,
  reason VARCHAR(200) NOT NULL,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(type);

-- 6. Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Crear triggers para updated_at
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at 
    BEFORE UPDATE ON categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at 
    BEFORE UPDATE ON suppliers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Insertar categorías de ejemplo
INSERT INTO categories (name, description, color) VALUES 
('Electrónicos', 'Dispositivos electrónicos y gadgets', '#3B82F6'),
('Ropa', 'Prendas de vestir y accesorios', '#EF4444'),
('Hogar', 'Artículos para el hogar', '#10B981'),
('Oficina', 'Suministros de oficina', '#F59E0B')
ON CONFLICT DO NOTHING;

-- 9. Insertar proveedores de ejemplo
INSERT INTO suppliers (name, email, phone, contact_person) VALUES 
('Proveedor General', 'contacto@proveedor.com', '+1234567890', 'Juan Pérez'),
('Tech Solutions', 'ventas@techsolutions.com', '+0987654321', 'María García')
ON CONFLICT DO NOTHING;

-- 10. Configurar RLS (Row Level Security) - Opcional
-- ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE movements ENABLE ROW LEVEL SECURITY;

-- 11. Crear políticas básicas (descomenta si usas RLS)
-- CREATE POLICY "Allow all operations for authenticated users" ON categories FOR ALL TO authenticated USING (true);
-- CREATE POLICY "Allow all operations for authenticated users" ON suppliers FOR ALL TO authenticated USING (true);
-- CREATE POLICY "Allow all operations for authenticated users" ON products FOR ALL TO authenticated USING (true);
-- CREATE POLICY "Allow all operations for authenticated users" ON movements FOR ALL TO authenticated USING (true);

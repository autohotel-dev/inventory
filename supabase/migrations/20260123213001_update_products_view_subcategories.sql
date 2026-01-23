-- Migración para actualizar products_view con soporte de subcategorías
-- Fecha: 2026-01-23

-- Primero eliminar la vista existente ya que estamos cambiando la estructura de columnas
DROP VIEW IF EXISTS products_view;

-- Crear la vista products_view para incluir subcategoría
CREATE VIEW products_view AS
SELECT 
  p.id,
  p.name,
  p.sku,
  p.description,
  p.price,
  p.cost,
  p.min_stock,
  p.unit,
  p.barcode,
  p.category_id,
  c.name AS category_name,
  p.subcategory_id,
  s.name AS subcategory_name,
  p.supplier_id,
  sup.name AS supplier_name,
  p.is_active,
  p.created_at,
  p.updated_at,
  COALESCE(inv.total_stock, 0) AS total_stock,
  COALESCE(inv.total_stock, 0) * p.price AS inventory_value,
  CASE 
    WHEN COALESCE(inv.total_stock, 0) <= 0 THEN 'critical'
    WHEN COALESCE(inv.total_stock, 0) < p.min_stock THEN 'low'
    WHEN COALESCE(inv.total_stock, 0) >= p.min_stock * 3 THEN 'high'
    ELSE 'normal'
  END AS stock_status
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN subcategories s ON p.subcategory_id = s.id
LEFT JOIN suppliers sup ON p.supplier_id = sup.id
LEFT JOIN (
  SELECT product_id, SUM(qty) AS total_stock
  FROM stock
  GROUP BY product_id
) inv ON p.id = inv.product_id;

-- Comentario en la vista
COMMENT ON VIEW products_view IS 'Vista de productos con información de categorías, subcategorías, proveedores y stock';

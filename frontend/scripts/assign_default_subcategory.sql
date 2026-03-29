-- Script para asignar subcategoría por defecto a productos de una categoría específica
-- Categoría: ee765e37-1875-4dfa-934f-99947ac82fcd (VINOS Y LICORES)
-- Subcategoría: c33a648f-0380-4f2e-90dc-3280fcbd6269

-- Actualizar productos que tienen la categoría especificada y no tienen subcategoría asignada
UPDATE products
SET subcategory_id = 'c33a648f-0380-4f2e-90dc-3280fcbd6269'
WHERE category_id = 'ee765e37-1875-4dfa-934f-99947ac82fcd'
  AND (subcategory_id IS NULL);

-- Verificar los productos actualizados (opcional, puedes ejecutar esto después para confirmar)
SELECT id, name, category_id, subcategory_id 
FROM products 
WHERE category_id = 'ee765e37-1875-4dfa-934f-99947ac82fcd';

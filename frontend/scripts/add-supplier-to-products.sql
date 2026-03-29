-- Script para agregar el campo supplier_id a la tabla products (si no existe)

-- Verificar si la columna existe antes de agregarla
DO $$ 
BEGIN
    -- Intentar agregar la columna supplier_id si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'supplier_id'
    ) THEN
        ALTER TABLE products 
        ADD COLUMN supplier_id UUID NULL;
        
        -- Agregar foreign key constraint
        ALTER TABLE products 
        ADD CONSTRAINT products_supplier_id_fkey 
        FOREIGN KEY (supplier_id) 
        REFERENCES suppliers (id) 
        ON DELETE SET NULL;
        
        -- Agregar índice para mejorar performance
        CREATE INDEX products_supplier_id_idx 
        ON products (supplier_id);
        
        RAISE NOTICE 'Campo supplier_id agregado a la tabla products';
    ELSE
        RAISE NOTICE 'El campo supplier_id ya existe en la tabla products';
    END IF;
END $$;

-- Verificar el resultado
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name IN ('supplier_id', 'category_id')
ORDER BY column_name;

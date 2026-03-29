
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'product_promotions'
        AND column_name = 'conditions'
    ) THEN
        ALTER TABLE product_promotions ADD COLUMN conditions JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

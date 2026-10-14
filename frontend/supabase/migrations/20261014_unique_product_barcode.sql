-- ════════════════════════════════════════════════════════════════════════════
-- Código de barras único por producto (auditoría de catálogo 2026-10-14)
--
-- "JUMEX PIÑA COCO" (SKU 7501013107340) tenía el código de barras de "JUMEX COCO PIÑA"
-- (7501013101362): al escanear se podía vender el otro producto. En 261 de 265 productos el
-- código de barras es igual al SKU, así que se le asigna el suyo. Después, un índice único
-- impide repetir un código de barras (los vacíos no cuentan).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

UPDATE public.products SET barcode = sku
 WHERE sku = '7501013107340' AND barcode = '7501013101362';

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_barcode
  ON public.products (barcode) WHERE barcode IS NOT NULL AND barcode <> '';

COMMIT;

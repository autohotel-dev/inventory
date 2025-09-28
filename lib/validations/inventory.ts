// Archivo simplificado - Solo validaciones básicas que realmente usamos
import { z } from "zod";

// Validación simple para productos (usada en SimpleProductsTable)
export const simpleProductSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  sku: z.string().min(1, "El SKU es requerido"),
  price: z.number().min(0, "El precio debe ser mayor a 0"),
  cost: z.number().min(0, "El costo debe ser mayor a 0"),
  min_stock: z.number().min(0, "El stock mínimo no puede ser negativo"),
  unit: z.string().min(1, "La unidad es requerida"),
  description: z.string().optional(),
  barcode: z.string().optional(),
  is_active: z.boolean(),
});

export type SimpleProductFormData = z.infer<typeof simpleProductSchema>;

/**
 * Validaciones para el sistema de inventario
 */
import { z } from "zod";
import {
  nonEmptyStringValidation,
  skuValidation,
  positiveNumberValidation,
  positiveNonZeroValidation,
  barcodeValidation,
} from "./common";

/**
 * Validación para productos
 * Incluye reglas de negocio como precio mayor que costo
 */
export const simpleProductSchema = z.object({
  name: nonEmptyStringValidation,
  sku: skuValidation,
  price: positiveNonZeroValidation,
  cost: positiveNumberValidation,
  min_stock: positiveNumberValidation,
  unit: nonEmptyStringValidation,
  description: z.string().optional(),
  barcode: barcodeValidation,
  is_active: z.boolean().default(true),
}).refine(
  (data) => data.price >= data.cost,
  {
    message: "El precio de venta debe ser mayor o igual al costo",
    path: ["price"],
  }
);

/**
 * Validación para categorías
 */
export const categorySchema = z.object({
  name: nonEmptyStringValidation,
  description: z.string().optional(),
});

/**
 * Validación para proveedores
 */
export const supplierSchema = z.object({
  name: nonEmptyStringValidation,
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().regex(/^[0-9]{10}$/, "Teléfono debe tener 10 dígitos").optional().or(z.literal("")),
  address: z.string().optional(),
  is_active: z.boolean().default(true),
});

/**
 * Validación para clientes
 */
export const customerSchema = z.object({
  name: nonEmptyStringValidation,
  tax_id: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().regex(/^[0-9]{10}$/, "Teléfono debe tener 10 dígitos").optional().or(z.literal("")),
  address: z.string().optional(),
  is_active: z.boolean().default(true),
});

/**
 * Validación para movimientos de inventario
 */
export const inventoryMovementSchema = z.object({
  product_id: nonEmptyStringValidation,
  warehouse_id: nonEmptyStringValidation,
  quantity: z.number().int("La cantidad debe ser un número entero").min(1, "La cantidad debe ser mayor a 0"),
  movement_type: z.enum(["IN", "OUT", "ADJUSTMENT"], {
    message: "Tipo de movimiento inválido",
  }),
  reason: nonEmptyStringValidation,
  notes: z.string().optional(),
});

/**
 * Validación para ajustes de stock
 */
export const stockAdjustmentSchema = z.object({
  product_id: nonEmptyStringValidation,
  warehouse_id: nonEmptyStringValidation,
  new_quantity: positiveNumberValidation,
  reason: nonEmptyStringValidation,
  notes: z.string().optional(),
});

export type SimpleProductFormData = z.infer<typeof simpleProductSchema>;
export type CategoryFormData = z.infer<typeof categorySchema>;
export type SupplierFormData = z.infer<typeof supplierSchema>;
export type CustomerFormData = z.infer<typeof customerSchema>;
export type InventoryMovementFormData = z.infer<typeof inventoryMovementSchema>;
export type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>;

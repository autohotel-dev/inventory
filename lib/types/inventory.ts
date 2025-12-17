/**
 * Tipos para el sistema de inventario
 */

/**
 * Representa un producto en el inventario
 * @property {string} id - Identificador único del producto
 * @property {string} name - Nombre del producto
 * @property {string} [description] - Descripción opcional del producto
 * @property {string} sku - Código SKU único del producto
 * @property {number} price - Precio de venta
 * @property {number} cost - Costo de adquisición
 * @property {number} min_stock - Stock mínimo antes de alertar
 * @property {string} unit - Unidad de medida (pz, kg, lt, etc.)
 * @property {string} [barcode] - Código de barras opcional
 * @property {boolean} is_active - Si el producto está activo
 * @property {string} created_at - Fecha de creación
 */
export interface SimpleProduct {
  id: string;
  name: string;
  description?: string;
  sku: string;
  price: number;
  cost: number;
  min_stock: number;
  unit: string;
  barcode?: string;
  is_active: boolean;
  created_at: string;
  category?: {
    id: string;
    name: string;
  };
  // Stock real calculado
  totalStock?: number;
  stockByWarehouse?: StockInfo[];
  // Información calculada
  inventoryValue?: number;
  profitMargin?: number;
  stockStatus?: 'critical' | 'low' | 'normal' | 'high';
}

/**
 * Información de stock por almacén
 * @property {string} warehouse_id - ID del almacén
 * @property {number} qty - Cantidad en stock
 */
export interface StockInfo {
  warehouse_id: string;
  qty: number;
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
}

/**
 * Categoría de productos
 * @property {string} id - Identificador único
 * @property {string} name - Nombre de la categoría
 * @property {string} [description] - Descripción opcional
 */
export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Proveedor
 * @property {string} id - Identificador único
 * @property {string} name - Nombre del proveedor
 * @property {string} [email] - Email de contacto
 * @property {string} [phone] - Teléfono de contacto
 * @property {string} [address] - Dirección
 * @property {boolean} is_active - Si el proveedor está activo
 */
export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Cliente
 * @property {string} id - Identificador único
 * @property {string} name - Nombre del cliente
 * @property {string} [tax_id] - RFC o identificación fiscal
 * @property {string} [email] - Email de contacto
 * @property {string} [phone] - Teléfono de contacto
 * @property {string} [address] - Dirección
 * @property {boolean} is_active - Si el cliente está activo
 */
export interface Customer {
  id: string;
  name: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  // Estadísticas calculadas
  total_orders?: number;
  total_spent?: number;
  last_order?: string | null;
  customer_type?: 'new' | 'regular' | 'vip';
  // Campos adicionales de la vista
  customer_name?: string;
  customer_email?: string;
}

/**
 * Orden de venta de cliente
 * @property {string} id - Identificador único
 * @property {string} customer_id - ID del cliente
 * @property {string} warehouse_id - ID del almacén
 * @property {string} status - Estado de la orden
 * @property {string} currency - Moneda (MXN, USD, etc.)
 * @property {number} subtotal - Subtotal sin impuestos
 * @property {number} tax - Impuestos
 * @property {number} total - Total a pagar
 * @property {number} discount - Descuento aplicado
 * @property {number} paid_amount - Monto pagado
 * @property {number} remaining_amount - Monto pendiente
 */
export interface CustomerSales {
  id: string;
  customer_id: string;
  warehouse_id: string;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  discount: number;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  order_number: string;
  order_date: string;
  remaining_amount: number;
  paid_amount: number;
}

/**
 * Tipo utilitario para crear un producto parcial (para formularios)
 */
export type PartialProduct = Partial<SimpleProduct> & Pick<SimpleProduct, 'name' | 'sku'>;

/**
 * Tipo utilitario para actualizar un producto (sin id ni created_at)
 */
export type ProductUpdate = Omit<SimpleProduct, 'id' | 'created_at'>;

/**
 * Tipo utilitario para crear un cliente
 */
export type CustomerCreate = Omit<Customer, 'id' | 'created_at' | 'total_orders' | 'total_spent' | 'last_order' | 'customer_type'>;


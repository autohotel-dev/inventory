// Tipos simplificados - Solo los que realmente usamos

// Tipo principal para productos (usado en SimpleProductsTable)
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

export interface StockInfo {
  warehouse_id: string;
  qty: number;
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
}

// Tipos básicos para futuras expansiones
export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

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

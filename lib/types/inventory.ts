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

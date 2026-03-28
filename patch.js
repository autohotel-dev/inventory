const fs = require('fs');
const file = 'components/customers/advanced-customers-table.tsx';
let content = fs.readFileSync(file, 'utf8');

const interfaceDef = `interface Customer {
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

interface CustomerStatistics {
  customer_id: string;
  total_orders: number;
  total_spent: number | string;
  last_order_date: string | null;
  customer_type: string;
}`;

content = content.replace(/interface Customer \{[\s\S]*?customer_email\?: string;\n\}/, interfaceDef);
fs.writeFileSync(file, content);

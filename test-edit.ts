import * as fs from 'fs';

let content = fs.readFileSync('components/movements/inventory-movements-table.tsx', 'utf8');

const interfacesToAdd = `
export interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

export interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export interface MovementReasonOption {
  id: number;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  name: string;
  description?: string;
}

export interface MovementFormData {
  product_id: string;
  warehouse_id: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason_id: string;
  reason: string;
  notes: string;
}
`;

content = content.replace(
  'export function InventoryMovementsTable() {',
  `${interfacesToAdd}\nexport function InventoryMovementsTable() {`
);

content = content.replace(
  'const [products, setProducts] = useState<any[]>([]);',
  'const [products, setProducts] = useState<ProductOption[]>([]);'
);

content = content.replace(
  'const [warehouses, setWarehouses] = useState<any[]>([]);',
  'const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);'
);

content = content.replace(
  'const [movementReasons, setMovementReasons] = useState<any[]>([]);',
  'const [movementReasons, setMovementReasons] = useState<MovementReasonOption[]>([]);'
);

content = content.replace(
  'const handleSave = async (movementData: any) => {',
  'const handleSave = async (movementData: MovementFormData) => {'
);

content = content.replace(
  `function MovementForm({ \n  products,\n  warehouses,\n  movementReasons,\n  onSave, \n  onCancel \n}: { \n  products: any[];\n  warehouses: any[];\n  movementReasons: any[];\n  onSave: (data: any) => void;\n  onCancel: () => void;\n}) {`,
  `function MovementForm({ \n  products,\n  warehouses,\n  movementReasons,\n  onSave, \n  onCancel \n}: { \n  products: ProductOption[];\n  warehouses: WarehouseOption[];\n  movementReasons: MovementReasonOption[];\n  onSave: (data: MovementFormData) => void;\n  onCancel: () => void;\n}) {`
);

content = content.replace(
  `const [formData, setFormData] = useState({`,
  `const [formData, setFormData] = useState<MovementFormData>({`
);

fs.writeFileSync('components/movements/inventory-movements-table.tsx', content);

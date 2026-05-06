import { apiClient } from "@/lib/api/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchMovementForm } from "@/components/movements/batch-movement-form";
import { IndividualMovementForm } from "@/components/movements/individual-movement-form";
import { UserRole } from "@/hooks/use-user-role";

async function getAvailableStockServer(productId: string, warehouseId: string): Promise<number> {
  try {
    const { apiClient } = await import("@/lib/api/client");
    const res = await apiClient.get(`/system/crud/stock?product_id=${productId}&warehouse_id=${warehouseId}&limit=1`);
    if (res.data && res.data.length > 0) {
      return Math.max(0, res.data[0].qty || 0);
    }
    return 0;
  } catch (error) {
    console.error("[STOCK ERROR] Error fetching stock:", error);
    return 0;
  }
}

async function getFormData() {
  const [{ data: products }, { data: warehouses }, { data: reasons }] = await Promise.all([
    apiClient.get("/system/crud/products").then(res => ({ data: res.data, error: null })),
    apiClient.get("/system/crud/warehouses").then(res => ({ data: res.data, error: null })),
    apiClient.get("/system/crud/movement_reasons").then(res => ({ data: res.data, error: null }))
  ]);
  return { products: products ?? [], warehouses: warehouses ?? [], reasons: reasons ?? [] };
}

async function createMovementAction(formData: FormData) {
  "use server";
  const supabase = await createClient();

  const type = String(formData.get("type") || "entry"); // entry | exit | transfer
  const product_id = String(formData.get("product_id") || "");
  const warehouse_id = String(formData.get("warehouse_id") || "");
  const qtyRaw = Number(formData.get("qty") || 0);
  const reason_code = String(formData.get("reason_code") || "ADJUSTMENT");
  const note = String(formData.get("note") || "");

  // Get current auth user for created_by
  const { data: { user } } = await supabase.auth.getUser();
  const created_by = user?.id || null;

  if (!product_id) throw new Error("Product is required");

  // fetch reason_id by code
  let reason = null;
  try {
    const { apiClient } = await import("@/lib/api/client");
    const res = await apiClient.get(`/system/crud/movement_reasons?code=${reason_code}&limit=1`);
    if (res.data && res.data.length > 0) {
      reason = res.data[0];
    }
  } catch(e) {}
  if (!reason) throw new Error("Invalid reason");

  if (type === "transfer") {
    const to_warehouse_id = String(formData.get("to_warehouse_id") || "");
    if (!warehouse_id || !to_warehouse_id) throw new Error("Both warehouses are required for transfer");
    if (warehouse_id === to_warehouse_id) throw new Error("Warehouses must be different");
    const qty = Math.abs(qtyRaw);

    // Validar stock en almacén origen
    const availableStock = await getAvailableStockServer(product_id, warehouse_id);
    if (availableStock < qty) {
      throw new Error(`Stock insuficiente en almacén origen. Disponible: ${availableStock} unidades, Solicitado: ${qty}`);
    }

    // two inserts: out from origin, in to destination
    const { error: e1 } = await apiClient.post("/system/crud/inventory_movements", {
      product_id,
      warehouse_id,
      quantity: qty,
      movement_type: 'OUT',
      reason_id: reason.id,
      reference_table: "TRANSFER",
      notes: note,
      created_by,
    }) as any;
    if (e1) throw e1;
    const { error: e2 } = await apiClient.post("/system/crud/inventory_movements", {
      product_id,
      warehouse_id: to_warehouse_id,
      quantity: qty,
      movement_type: 'IN',
      reason_id: reason.id,
      reference_table: "TRANSFER",
      notes: note,
      created_by,
    }) as any;
    if (e2) throw e2;
    revalidatePath("/movements");
    redirect("/movements");
  } else {
    if (!warehouse_id) throw new Error("Warehouse is required");

    let movementType: 'IN' | 'OUT' | 'ADJUSTMENT';
    if (type === "entry") {
      movementType = 'IN';
    } else if (type === "exit") {
      movementType = 'OUT';
    } else if (type === "adjustment") {
      movementType = 'ADJUSTMENT';
    } else {
      movementType = 'IN'; // default
    }

    const qty = Math.abs(qtyRaw);

    // Validar stock disponible para salidas
    if (movementType === 'OUT') {
      const availableStock = await getAvailableStockServer(product_id, warehouse_id);
      if (availableStock < qty) {
        throw new Error(`Stock insuficiente. Disponible: ${availableStock} unidades, Solicitado: ${qty}`);
      }
    }

    const { error } = await apiClient.post("/system/crud/inventory_movements", {
      product_id,
      warehouse_id,
      quantity: qty,
      movement_type: movementType,
      reason_id: reason.id,
      notes: note,
      created_by,
    }) as any;
    if (error) throw error;
    revalidatePath("/movements");
    redirect("/movements");
  }
}

async function createBatchMovementsAction(formData: FormData) {
  "use server";
  const supabase = await createClient();

  // Get current auth user for created_by
  const { data: { user } } = await supabase.auth.getUser();
  const created_by = user?.id || null;

  const movementType = String(formData.get("movementType") || "IN");
  const reasonCode = String(formData.get("reasonCode") || "ADJUSTMENT");
  const itemsJson = String(formData.get("items") || "[]");
  const toWarehouseId = formData.get("toWarehouseId") ? String(formData.get("toWarehouseId")) : null;

  let items;
  try {
    items = JSON.parse(itemsJson);
  } catch {
    throw new Error("Invalid items data");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one item is required");
  }

  // Get reason ID
  let reason = null;
  try {
    const { apiClient } = await import("@/lib/api/client");
    const res = await apiClient.get(`/system/crud/movement_reasons?code=${reasonCode}&limit=1`);
    if (res.data && res.data.length > 0) {
      reason = res.data[0];
    }
  } catch(e) {}

  if (!reason) throw new Error("Invalid reason");

  // Handle TRANSFER type
  if (movementType === 'TRANSFER') {
    if (!toWarehouseId) {
      throw new Error("Almacén destino es requerido para transferencias");
    }

    // Obtener productos para nombres en errores
    const productIds = items.map((i: any) => i.product_id);
    let products = [];
    try {
      const { apiClient } = await import("@/lib/api/client");
      // Since it's an IN query, we can query them individually or fetch all and filter
      const res = await apiClient.get('/system/crud/products');
      products = (res.data || []).filter((p: any) => productIds.includes(p.id));
    } catch(e) {}

    const productsMap = new Map(products?.map((p: any) => [p.id, p]) || []);

    // Validar stock de cada producto en almacén origen
    for (const item of items) {
      const available = await getAvailableStockServer(item.product_id, item.warehouse_id);
      if (available < item.quantity) {
        const product = productsMap.get(item.product_id);
        const productName = product ? `${product.sku} - ${product.name}` : 'Producto';
        throw new Error(
          `Stock insuficiente para ${productName}. Disponible: ${available}, Solicitado: ${item.quantity}`
        );
      }
    }

    // Crear movimientos de salida (OUT) desde almacén origen
    const outMovements = items.map((item: any) => ({
      product_id: item.product_id,
      warehouse_id: item.warehouse_id,
      quantity: Number(item.quantity),
      movement_type: 'OUT',
      reason_id: reason.id,
      reference_table: "TRANSFER",
      notes: item.notes || null,
      created_by,
    }));

    // Crear movimientos de entrada (IN) al almacén destino
    const inMovements = items.map((item: any) => ({
      product_id: item.product_id,
      warehouse_id: toWarehouseId,
      quantity: Number(item.quantity),
      movement_type: 'IN',
      reason_id: reason.id,
      reference_table: "TRANSFER",
      notes: item.notes || null,
      created_by,
    }));

    // Insertar todos los movimientos
    const { error: outError } = await apiClient.post("/system/crud/inventory_movements", outMovements) as any;
    if (outError) throw outError;

    const { error: inError } = await apiClient.post("/system/crud/inventory_movements", inMovements) as any;
    if (inError) throw inError;

    revalidatePath("/movements");
    redirect("/movements");
  }

  // Validar stock para movimientos de salida (no transferencias)
  if (movementType === 'OUT') {
    // Obtener productos para nombres en errores
    const productIds = items.map((i: any) => i.product_id);
    let products = [];
    try {
      const { apiClient } = await import("@/lib/api/client");
      const res = await apiClient.get('/system/crud/products');
      products = (res.data || []).filter((p: any) => productIds.includes(p.id));
    } catch(e) {}

    const productsMap = new Map(products?.map((p: any) => [p.id, p]) || []);

    // Validar stock de cada producto
    for (const item of items) {
      const available = await getAvailableStockServer(item.product_id, item.warehouse_id);
      if (available < item.quantity) {
        const product = productsMap.get(item.product_id);
        const productName = product ? `${product.sku} - ${product.name} ` : 'Producto';
        throw new Error(
          `Stock insuficiente para ${productName}.Disponible: ${available}, Solicitado: ${item.quantity} `
        );
      }
    }
  }

  // Create batch movements (IN, OUT, ADJUSTMENT)
  const movements = items.map((item: any) => ({
    product_id: item.product_id,
    warehouse_id: item.warehouse_id,
    quantity: Number(item.quantity),
    movement_type: movementType,
    reason_id: reason.id,
    reason: reason.name,
    notes: item.notes || null,
    created_by,
  }));

  const { error } = await apiClient.post("/system/crud/inventory_movements", movements) as any;

  if (error) throw error;

  revalidatePath("/movements");
  redirect("/movements");
}

export default async function NewMovementPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check role
  let employee = null;
  try {
    const { apiClient } = await import("@/lib/api/client");
    const res = await apiClient.get(`/system/crud/employees?auth_user_id=${user.id}&limit=1`);
    if (res.data && res.data.length > 0) employee = res.data[0];
  } catch(e) {}

  const role = employee?.role as UserRole;
  const isAuthorized = role === "receptionist" || role === "admin" || role === "manager";

  if (!isAuthorized) {
    redirect("/dashboard");
  }

  const { products, warehouses, reasons } = await getFormData();

  const handleBatchSubmit = async (data: {
    movementType: string;
    reasonCode: string;
    items: any[];
    toWarehouseId?: string;
  }) => {
    "use server";
    const formData = new FormData();
    formData.append("movementType", data.movementType);
    formData.append("reasonCode", data.reasonCode);
    formData.append("items", JSON.stringify(data.items));
    if (data.toWarehouseId) {
      formData.append("toWarehouseId", data.toWarehouseId);
    }
    await createBatchMovementsAction(formData);
  };

  return (
    <div className="w-full px-6 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nuevo Movimiento de Inventario</h1>
        <p className="text-muted-foreground mt-1">
          Registra entradas, salidas o transferencias de productos
        </p>
      </div>

      <Tabs defaultValue="batch" className="w-full">
        <TabsList className="w-full max-w-3xl grid grid-cols-2 p-2 rounded-2xl mx-auto">
          <TabsTrigger
            value="batch"
            className="py-6 px-4 data-[state=active]:from-emerald-500 data-[state=active]:to-emerald-600 data-[state=active]:shadow-[0_0_25px_rgba(16,185,129,0.5)] data-[state=active]:border-emerald-400/50 data-[state=active]:text-white"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="7" height="7" x="3" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="14" rx="1" />
                  <rect width="7" height="7" x="3" y="14" rx="1" />
                </svg>
                <span className="text-base font-bold">Por Lotes</span>
              </div>
              <span className="text-sm opacity-90 font-normal">Múltiples productos</span>
            </div>
          </TabsTrigger>
          <TabsTrigger
            value="individual"
            className="py-6 px-4 data-[state=active]:from-violet-500 data-[state=active]:to-violet-600 data-[state=active]:shadow-[0_0_25px_rgba(139,92,246,0.5)] data-[state=active]:border-violet-400/50 data-[state=active]:text-white"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  <path d="m3.3 7 8.7 5 8.7-5" />
                  <path d="M12 22V12" />
                </svg>
                <span className="text-base font-bold">Individual</span>
              </div>
              <span className="text-sm opacity-80 font-normal">Un solo producto</span>
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="batch" className="mt-6">
          <BatchMovementForm
            products={products}
            warehouses={warehouses}
            reasons={reasons}
            onSubmit={handleBatchSubmit}
          />
        </TabsContent>

        <TabsContent value="individual" className="mt-6">
          <IndividualMovementForm
            products={products}
            warehouses={warehouses}
            reasons={reasons}
            onSubmit={createMovementAction}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

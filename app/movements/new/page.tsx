import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchMovementForm } from "@/components/movements/batch-movement-form";
import { IndividualMovementForm } from "@/components/movements/individual-movement-form";
import { getAvailableStock } from "@/lib/utils/stock-helpers";

async function getFormData() {
  const supabase = await createClient();
  const [{ data: products }, { data: warehouses }, { data: reasons }] = await Promise.all([
    supabase.from("products").select("id, sku, name").eq("is_active", true).order("name"),
    supabase.from("warehouses").select("id, code, name").eq("is_active", true).order("name"),
    supabase.from("movement_reasons").select("id, code, description, movement_type").order("code")
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

  if (!product_id) throw new Error("Product is required");

  // fetch reason_id by code
  const { data: reason, error: reasonErr } = await supabase
    .from("movement_reasons")
    .select("id, code")
    .eq("code", reason_code)
    .single();
  if (reasonErr || !reason) throw new Error("Invalid reason");

  if (type === "transfer") {
    const to_warehouse_id = String(formData.get("to_warehouse_id") || "");
    if (!warehouse_id || !to_warehouse_id) throw new Error("Both warehouses are required for transfer");
    if (warehouse_id === to_warehouse_id) throw new Error("Warehouses must be different");
    const qty = Math.abs(qtyRaw);

    // Validar stock en almacén origen
    const availableStock = await getAvailableStock(product_id, warehouse_id);
    if (availableStock < qty) {
      throw new Error(`Stock insuficiente en almacén origen. Disponible: ${availableStock} unidades, Solicitado: ${qty}`);
    }

    // two inserts: out from origin, in to destination
    const { error: e1 } = await supabase.from("inventory_movements").insert({
      product_id,
      warehouse_id,
      quantity: qty,
      movement_type: 'OUT',
      reason_id: reason.id,
      reference_table: "TRANSFER",
      notes: note,
    });
    if (e1) throw e1;
    const { error: e2 } = await supabase.from("inventory_movements").insert({
      product_id,
      warehouse_id: to_warehouse_id,
      quantity: qty,
      movement_type: 'IN',
      reason_id: reason.id,
      reference_table: "TRANSFER",
      notes: note,
    });
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
      const availableStock = await getAvailableStock(product_id, warehouse_id);
      if (availableStock < qty) {
        throw new Error(`Stock insuficiente. Disponible: ${availableStock} unidades, Solicitado: ${qty}`);
      }
    }

    const { error } = await supabase.from("inventory_movements").insert({
      product_id,
      warehouse_id,
      quantity: qty,
      movement_type: movementType,
      reason_id: reason.id,
      notes: note,
    });
    if (error) throw error;
    revalidatePath("/movements");
    redirect("/movements");
  }
}

async function createBatchMovementsAction(formData: FormData) {
  "use server";
  const supabase = await createClient();

  const movementType = String(formData.get("movementType") || "IN");
  const reasonCode = String(formData.get("reasonCode") || "ADJUSTMENT");
  const itemsJson = String(formData.get("items") || "[]");

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
  const { data: reason, error: reasonErr } = await supabase
    .from("movement_reasons")
    .select("id, code, name")
    .eq("code", reasonCode)
    .single();

  if (reasonErr || !reason) throw new Error("Invalid reason");

  // Validar stock para movimientos de salida
  if (movementType === 'OUT') {
    // Obtener productos para nombres en errores
    const productIds = items.map((i: any) => i.product_id);
    const { data: products } = await supabase
      .from("products")
      .select("id, name, sku")
      .in("id", productIds);

    const productsMap = new Map(products?.map(p => [p.id, p]) || []);

    // Validar stock de cada producto
    for (const item of items) {
      const available = await getAvailableStock(item.product_id, item.warehouse_id);
      if (available < item.quantity) {
        const product = productsMap.get(item.product_id);
        const productName = product ? `${product.sku} - ${product.name} ` : 'Producto';
        throw new Error(
          `Stock insuficiente para ${productName}.Disponible: ${available}, Solicitado: ${item.quantity} `
        );
      }
    }
  }

  // Create batch movements
  const movements = items.map((item: any) => ({
    product_id: item.product_id,
    warehouse_id: item.warehouse_id,
    quantity: Number(item.quantity),
    movement_type: movementType,
    reason_id: reason.id,
    reason: reason.name,  // Add reason name
    notes: item.notes || null,
  }));

  const { error } = await supabase.from("inventory_movements").insert(movements);

  if (error) throw error;

  revalidatePath("/movements");
  redirect("/movements");
}

export default async function NewMovementPage() {
  const { products, warehouses, reasons } = await getFormData();

  const handleBatchSubmit = async (data: {
    movementType: string;
    reasonCode: string;
    items: any[];
  }) => {
    "use server";
    const formData = new FormData();
    formData.append("movementType", data.movementType);
    formData.append("reasonCode", data.reasonCode);
    formData.append("items", JSON.stringify(data.items));
    await createBatchMovementsAction(formData);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nuevo Movimiento de Inventario</h1>
        <p className="text-muted-foreground mt-1">
          Registra entradas, salidas o transferencias de productos
        </p>
      </div>

      <Tabs defaultValue="batch" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="batch">Por Lotes (Múltiple)</TabsTrigger>
          <TabsTrigger value="individual">Individual</TabsTrigger>
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

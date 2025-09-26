import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SubmitButton } from "@/components/ui/submit-button";

// Explicit types to help TS understand nested selects returned by Supabase
type PurchaseOrderDetail = {
  id: string;
  created_at: string;
  status: string;
  currency: string;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  notes: string | null;
  supplier_id: string;
  warehouse_id: string;
  suppliers?: { name?: string | null } | null;
  warehouses?: { code?: string | null; name?: string | null } | null;
};

type PurchaseOrderItemView = {
  id: string;
  product_id: string;
  qty: number;
  unit_cost: number;
  tax: number | null;
  total: number;
  products?: { sku?: string | null; name?: string | null } | null;
};

async function getPurchaseDetail(id: string) {
  const supabase = await createClient();
  const { data: order, error: orderErr } = await supabase
    .from("purchase_orders")
    .select([
      "id",
      "created_at",
      "status",
      "currency",
      "subtotal",
      "tax",
      "total",
      "notes",
      "supplier_id",
      "warehouse_id",
      "suppliers:supplier_id(name)",
      "warehouses:warehouse_id(code, name)"
    ].join(","))
    .eq("id", id)
    .single();
  if (orderErr || !order) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("purchase_order_items")
    .select("id, product_id, qty, unit_cost, tax, total, products:product_id(sku, name)")
    .eq("purchase_order_id", id)
    .order("id", { ascending: true });
  if (itemsErr) throw itemsErr;

  const { data: products } = await supabase
    .from("products")
    .select("id, sku, name")
    .eq("is_active", true)
    .order("name");

  const orderTyped = order as unknown as PurchaseOrderDetail;
  const itemsTyped = (items ?? []) as unknown as PurchaseOrderItemView[];

  return { order: orderTyped, items: itemsTyped, products: (products ?? []) as any };
}

async function recomputeOrderTotals(orderId: string) {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("purchase_order_items")
    .select("total")
    .eq("purchase_order_id", orderId);
  if (error) throw error;
  const subtotal = (rows ?? []).reduce((a, r: any) => a + Number(r.total || 0), 0);
  // Nota: si tu total de item ya incluye impuestos, tax es separado opcional.
  // Aquí asumimos que item.total = qty*unit_cost + tax
  const tax = 0; // podrías separar impuestos por línea y sumarlos si prefieres.
  const total = subtotal; // simplificado
  const { error: updErr } = await supabase
    .from("purchase_orders")
    .update({ subtotal, tax, total })
    .eq("id", orderId);
  if (updErr) throw updErr;
}

async function addItemAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("orderId") || "");
  const product_id = String(formData.get("product_id") || "");
  const qty = Number(formData.get("qty") || 0);
  const unit_cost = Number(formData.get("unit_cost") || 0);
  const tax = Number(formData.get("tax") || 0);

  const supabase = await createClient();
  // Validate order is OPEN
  const { data: ord } = await supabase.from("purchase_orders").select("status").eq("id", orderId).single();
  if (!ord || ord.status !== "OPEN") throw new Error("Order is not OPEN");

  const { error } = await supabase.from("purchase_order_items").insert({
    purchase_order_id: orderId,
    product_id,
    qty,
    unit_cost,
    tax,
  });
  if (error) throw error;
  await recomputeOrderTotals(orderId);
  revalidatePath(`/purchases/${orderId}`);
}

async function deleteItemAction(formData: FormData) {
  "use server";
  const itemId = String(formData.get("itemId") || "");
  const orderId = String(formData.get("orderId") || "");
  if (!itemId || !orderId) return;
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_order_items").delete().eq("id", itemId);
  if (error) throw error;
  await recomputeOrderTotals(orderId);
  revalidatePath(`/purchases/${orderId}`);
}

async function deleteItem(itemId: string, orderId: string) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_order_items").delete().eq("id", itemId);
  if (error) throw error;
  await recomputeOrderTotals(orderId);
  revalidatePath(`/purchases/${orderId}`);
}

async function receiveOrderAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("orderId") || "");
  const supabase = await createClient();

  // fetch order + items
  const { data: order0 } = await supabase
    .from("purchase_orders")
    .select("id, status, warehouse_id")
    .eq("id", orderId)
    .single();
  if (!order0) throw new Error("Order not found");
  if (order0.status !== "OPEN") throw new Error("Only OPEN orders can be received");

  const { data: items } = await supabase
    .from("purchase_order_items")
    .select("product_id, qty")
    .eq("purchase_order_id", orderId);

  if (!items || items.length === 0) throw new Error("No items to receive");

  // reason_id for PURCHASE
  const { data: reason } = await supabase
    .from("movement_reasons")
    .select("id")
    .eq("code", "PURCHASE")
    .single();
  if (!reason) throw new Error("Reason PURCHASE not found");

  // Insert movements in batch
  const rows = items.map((it: any) => ({
    product_id: it.product_id,
    warehouse_id: order0.warehouse_id,
    qty: Math.abs(Number(it.qty || 0)),
    reason_id: reason.id,
    reference_table: "purchase_orders",
    reference_id: orderId,
    note: "Received from PO",
  }));
  const { error: movErr } = await supabase.from("inventory_movements").insert(rows);
  if (movErr) throw movErr;

  // Update order status
  const { data: updated, error: updErr } = await supabase
    .from("purchase_orders")
    .update({ status: "RECEIVED" })
    .eq("id", orderId)
    .eq("status", "OPEN")
    .select("id")
    .single();
  if (updErr) throw updErr;
  if (!updated) throw new Error("Order has already been processed by another session");

  revalidatePath(`/purchases/${orderId}`);
  redirect(`/purchases/${orderId}`);
}

export default async function PurchaseDetailPage({ params }: { params: { id: string } }) {
  const detail = await getPurchaseDetail(params.id);
  if (!detail) return notFound();
  const { order, items, products } = detail;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Order</h1>
          <p className="text-sm text-muted-foreground">{order.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 rounded border text-sm">Status: {order.status}</span>
          {order.status === "OPEN" && (
            <form action={receiveOrderAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <SubmitButton pendingText="Receiving...">Receive</SubmitButton>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Supplier</div>
          <div className="font-medium">{order.suppliers?.name}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Warehouse</div>
          <div className="font-medium">{order.warehouses?.code} - {order.warehouses?.name}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Totals</div>
          <div className="font-medium">Subtotal: {Number(order.subtotal || 0).toFixed(2)} {order.currency}</div>
          <div className="font-medium">Tax: {Number(order.tax || 0).toFixed(2)} {order.currency}</div>
          <div className="font-semibold">Total: {Number(order.total || 0).toFixed(2)} {order.currency}</div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Items</h2>
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3">Product</th>
                <th className="text-right p-3">Qty</th>
                <th className="text-right p-3">Unit Cost</th>
                <th className="text-right p-3">Tax</th>
                <th className="text-right p-3">Total</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any) => (
                <tr key={it.id} className="border-t">
                  <td className="p-3">{it.products?.sku} - {it.products?.name}</td>
                  <td className="p-3 text-right">{Number(it.qty).toFixed(2)}</td>
                  <td className="p-3 text-right">{Number(it.unit_cost).toFixed(2)}</td>
                  <td className="p-3 text-right">{Number(it.tax || 0).toFixed(2)}</td>
                  <td className="p-3 text-right">{Number(it.total).toFixed(2)}</td>
                  <td className="p-3 text-right">
                    <form action={deleteItemAction} onSubmit={(e) => { if (!confirm('Delete this item?')) e.preventDefault(); }}>
                      <input type="hidden" name="itemId" value={it.id} />
                      <input type="hidden" name="orderId" value={order.id} />
                      <Button variant="destructive" type="submit" size="sm">Delete</Button>
                    </form>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">No items yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {order.status === "OPEN" && (
        <div className="space-y-3 max-w-2xl">
          <h3 className="text-lg font-semibold">Add Item</h3>
          <form action={addItemAction} className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input type="hidden" name="orderId" value={order.id} />
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="product_id">Product</Label>
              <SearchableSelect
                id="product_id"
                name="product_id"
                required
                className="w-full"
                placeholder="Search product..."
                options={(products ?? []).map((p: any) => ({ value: p.id, label: `${p.sku} - ${p.name}` }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qty">Qty</Label>
              <Input id="qty" name="qty" type="number" min="0" step="0.01" defaultValue={1} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit_cost">Unit Cost</Label>
              <Input id="unit_cost" name="unit_cost" type="number" min="0" step="0.01" defaultValue={0} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tax">Tax</Label>
              <Input id="tax" name="tax" type="number" min="0" step="0.01" defaultValue={0} />
            </div>
            <div className="md:col-span-5">
              <SubmitButton pendingText="Adding...">Add Item</SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

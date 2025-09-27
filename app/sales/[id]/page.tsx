import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SubmitButton } from "@/components/ui/submit-button";
import { AddSalesItemForm } from "@/components/add-sales-item-form";

// Types to help TS with nested selects
type SalesOrderDetail = {
  id: string;
  created_at: string;
  status: string;
  currency: string;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  notes: string | null;
  customer_id: string | null;
  warehouse_id: string;
  customers?: { name?: string | null } | null;
  warehouses?: { code?: string | null; name?: string | null } | null;
};

type SalesOrderItemView = {
  id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  discount: number | null;
  tax: number | null;
  total: number; // generated in DB
  products?: { sku?: string | null; name?: string | null } | null;
};

type StockRow = {
  total: number | null;
};

type ExistingItem = {
  qty: number | null;
};

type Product = {
  id: string;
  sku: string | null;
  name: string | null;
};

type StockData = {
  product_id: string;
  warehouse_id: string;
  qty: number | null;
};

type MovementRow = {
  product_id: string;
  warehouse_id: string;
  qty: number;
  reason_id: string;
  reference: string;
};

type SalesOrderItemBasic = {
  product_id: string;
  qty: number;
};

type ProductSku = {
  sku: string | null;
};

async function getSalesDetail(id: string) {
  const supabase = await createClient();
  const { data: order, error: orderErr } = await supabase
    .from("sales_orders")
    .select([
      "id",
      "created_at",
      "status",
      "currency",
      "subtotal",
      "tax",
      "total",
      "notes",
      "customer_id",
      "warehouse_id",
      "customers:customer_id(name)",
      "warehouses:warehouse_id(code, name)",
    ].join(","))
    .eq("id", id)
    .single();
  if (orderErr || !order) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("sales_order_items")
    .select("id, product_id, qty, unit_price, discount, tax, total, products:product_id(sku, name)")
    .eq("sales_order_id", id)
    .order("id", { ascending: true });
  if (itemsErr) throw itemsErr;

  const { data: products } = await supabase
    .from("products")
    .select("id, sku, name")
    .eq("is_active", true)
    .order("name");

  // Fetch stock for this order's warehouse to show availability
  const { data: stockRows } = await supabase
    .from("stock")
    .select("product_id, warehouse_id, qty")
    .eq("warehouse_id", (order as unknown as SalesOrderDetail).warehouse_id);

  const stockMap: Record<string, number> = {};
  for (const s of stockRows ?? []) {
    stockMap[String((s as StockData).product_id)] = Number((s as StockData).qty || 0);
  }

  // Compute reserved qty in current order (sum by product)
  const reservedMap: Record<string, number> = {};
  for (const it of items ?? []) {
    const pid = String((it as SalesOrderItemView).product_id);
    reservedMap[pid] = (reservedMap[pid] || 0) + Math.abs(Number((it as SalesOrderItemView).qty || 0));
  }

  const orderTyped = order as unknown as SalesOrderDetail;
  const itemsTyped = (items ?? []) as unknown as SalesOrderItemView[];
  return { order: orderTyped, items: itemsTyped, products: (products ?? []), stockMap, reservedMap };
}

async function recomputeOrderTotals(orderId: string) {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("sales_order_items")
    .select("total")
    .eq("sales_order_id", orderId);
  if (error) throw error;
  const subtotal = (rows ?? []).reduce((a, r: StockRow) => a + Number(r.total || 0), 0);
  const tax = 0; // totals already include line-level tax in "total"
  const total = subtotal;
  const { error: updErr } = await supabase
    .from("sales_orders")
    .update({ subtotal, tax, total })
    .eq("id", orderId);
  if (updErr) throw updErr;
}

async function addItemAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("orderId") || "");
  const product_id = String(formData.get("product_id") || "");
  const qty = Number(formData.get("qty") || 0);
  let unit_price = Number(formData.get("unit_price") || 0);
  const discount = Number(formData.get("discount") || 0);
  const tax = Number(formData.get("tax") || 0);

  const supabase = await createClient();
  // Validate order is OPEN
  const { data: ord } = await supabase.from("sales_orders").select("status, warehouse_id").eq("id", orderId).single();
  if (!ord || ord.status !== "OPEN") throw new Error("Order is not OPEN");

  // Prefill unit_price from product if not provided or <= 0
  if (!unit_price || unit_price <= 0) {
    const { data: prod } = await supabase.from("products").select("price").eq("id", product_id).single();
    if (prod && typeof prod.price === "number") {
      unit_price = Number(prod.price) || 0;
    }
  }

  // Validate requested qty does not exceed available stock in this warehouse (stock - already in order)
  const { data: stockRow } = await supabase
    .from("stock")
    .select("qty")
    .eq("product_id", product_id)
    .eq("warehouse_id", ord.warehouse_id)
    .single();
  const available = Number(stockRow?.qty || 0);
  const { data: existingItems } = await supabase
    .from("sales_order_items")
    .select("qty")
    .eq("sales_order_id", orderId)
    .eq("product_id", product_id);
  const already = (existingItems ?? []).reduce((a, r: ExistingItem) => a + Math.abs(Number(r.qty || 0)), 0);
  if (already + Math.abs(qty) > available) {
    throw new Error("Requested quantity exceeds available stock for this product in the selected warehouse");
  }

  const { error } = await supabase.from("sales_order_items").insert({
    sales_order_id: orderId,
    product_id,
    qty,
    unit_price,
    discount,
    tax,
  });
  if (error) throw error;
  await recomputeOrderTotals(orderId);
  revalidatePath(`/sales/${orderId}`);
}

async function deleteItemAction(formData: FormData) {
  "use server";
  const itemId = String(formData.get("itemId") || "");
  const orderId = String(formData.get("orderId") || "");
  if (!itemId || !orderId) return;
  const supabase = await createClient();
  const { error } = await supabase.from("sales_order_items").delete().eq("id", itemId);
  if (error) throw error;
  await recomputeOrderTotals(orderId);
  revalidatePath(`/sales/${orderId}`);
}

async function deliverOrderAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("orderId") || "");
  const supabase = await createClient();

  // fetch order + items
  const { data: order } = await supabase
    .from("sales_orders")
    .select("id, status, warehouse_id")
    .eq("id", orderId)
    .single();
  if (!order) throw new Error("Order not found");
  if (order.status !== "OPEN") throw new Error("Only OPEN orders can be delivered");

  const { data: items } = await supabase
    .from("sales_order_items")
    .select("product_id, qty")
    .eq("sales_order_id", orderId);

  if (!items || items.length === 0) throw new Error("No items to deliver");

  // Validate stock in the warehouse before delivering
  const productIds = Array.from(new Set(items.map((it: SalesOrderItemBasic) => it.product_id)));
  const { data: stockRows } = await supabase
    .from("stock")
    .select("product_id, warehouse_id, qty")
    .eq("warehouse_id", order.warehouse_id)
    .in("product_id", productIds);

  const stockMap = new Map<string, number>();
  for (const s of stockRows ?? []) {
    stockMap.set(s.product_id as string, Number(s.qty || 0));
  }
  // accumulate required qty per product
  const requiredMap = new Map<string, number>();
  for (const it of items) {
    const pid = it.product_id as string;
    requiredMap.set(pid, (requiredMap.get(pid) || 0) + Math.abs(Number(it.qty || 0)));
  }
  const insufficient: string[] = [];
  for (const [pid, req] of requiredMap.entries()) {
    const have = stockMap.get(pid) || 0;
    if (have < req) insufficient.push(pid);
  }
  if (insufficient.length > 0) {
    // fetch SKUs for better error message
    const { data: badProds } = await supabase
      .from("products")
      .select("sku")
      .in("id", insufficient);
    const list = (badProds ?? []).map((p: ProductSku) => p.sku).filter(Boolean).join(", ");
    throw new Error(`Insufficient stock for: ${list || insufficient.join(", ")}`);
  }

  // reason_id for SALE
  const { data: reason } = await supabase
    .from("movement_reasons")
    .select("id")
    .eq("code", "SALE")
    .single();
  if (!reason) throw new Error("Reason SALE not found");

  // Insert movements in batch (negative qty)
  const rows = items.map((it: SalesOrderItemBasic) => ({
    product_id: it.product_id,
    warehouse_id: order.warehouse_id,
    qty: -Math.abs(Number(it.qty || 0)),
    reason_id: reason.id,
    reference_table: "sales_orders",
    reference_id: orderId,
    note: "Delivered from SO",
  }));
  const { error: movErr } = await supabase.from("inventory_movements").insert(rows);
  if (movErr) throw movErr;

  // Update order status
  const { data: updated, error: updErr } = await supabase
    .from("sales_orders")
    .update({ status: "INVOICED" })
    .eq("id", orderId)
    .eq("status", "OPEN")
    .select("id")
    .single();
  if (updErr) throw updErr;
  if (!updated) throw new Error("Order has already been processed by another session");

  revalidatePath(`/sales/${orderId}`);
  redirect(`/sales/${orderId}`);
}

export default async function SalesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const detail = await getSalesDetail(resolvedParams.id);
  if (!detail) return notFound();
  const { order, items, products, stockMap, reservedMap } = detail;
  const productOptions = (products ?? []).map((p: Product) => {
    const stock = Number(stockMap?.[p.id] || 0);
    const reserved = Number(reservedMap?.[p.id] || 0);
    const available = Math.max(0, stock - reserved);
    return { value: p.id, label: `${p.sku} - ${p.name} (Avail: ${available})` };
  });

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sales Order</h1>
          <p className="text-sm text-muted-foreground">{order.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 rounded border text-sm">Status: {order.status}</span>
          {order.status === "OPEN" && (
            <form action={deliverOrderAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <SubmitButton pendingText="Delivering...">Deliver</SubmitButton>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Customer</div>
          <div className="font-medium">{order.customers?.name}</div>
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
                <th className="text-right p-3">Unit Price</th>
                <th className="text-right p-3">Discount</th>
                <th className="text-right p-3">Tax</th>
                <th className="text-right p-3">Total</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: SalesOrderItemView) => (
                <tr key={it.id} className="border-t">
                  <td className="p-3">{it.products?.sku} - {it.products?.name}</td>
                  <td className="p-3 text-right">{Number(it.qty).toFixed(2)}</td>
                  <td className="p-3 text-right">{Number(it.unit_price).toFixed(2)}</td>
                  <td className="p-3 text-right">{Number(it.discount || 0).toFixed(2)}</td>
                  <td className="p-3 text-right">{Number(it.tax || 0).toFixed(2)}</td>
                  <td className="p-3 text-right">{Number(it.total).toFixed(2)}</td>
                  <td className="p-3 text-right">
                    {order.status === "OPEN" && (
                      <form action={deleteItemAction} onSubmit={(e) => { if (!confirm('Delete this item?')) e.preventDefault(); }}>
                        <input type="hidden" name="itemId" value={it.id} />
                        <input type="hidden" name="orderId" value={order.id} />
                        <Button variant="destructive" type="submit" size="sm">Delete</Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">No items yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {order.status === "OPEN" && (
        <AddSalesItemForm 
          orderId={order.id}
          productOptions={productOptions}
          addItemAction={addItemAction}
        />
      )}
    </div>
  );
}

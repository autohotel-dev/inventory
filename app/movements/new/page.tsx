import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { SearchableSelect } from "@/components/ui/searchable-select";

async function getFormData() {
  const supabase = await createClient();
  const [{ data: products }, { data: warehouses }, { data: reasons }] = await Promise.all([
    supabase.from("products").select("id, sku, name").eq("is_active", true).order("name"),
    supabase.from("warehouses").select("id, code, name").eq("is_active", true).order("name"),
    supabase.from("movement_reasons").select("id, code, description").order("code")
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
    // two inserts: out from origin, in to destination
    const { error: e1 } = await supabase.from("inventory_movements").insert({
      product_id,
      warehouse_id,
      qty: -qty, // salida
      reason_id: reason.id,
      reference_table: "TRANSFER",
      note,
    });
    if (e1) throw e1;
    const { error: e2 } = await supabase.from("inventory_movements").insert({
      product_id,
      warehouse_id: to_warehouse_id,
      qty: qty, // entrada
      reason_id: reason.id,
      reference_table: "TRANSFER",
      note,
    });
    if (e2) throw e2;
    revalidatePath("/movements");
    redirect("/movements");
  } else {
    if (!warehouse_id) throw new Error("Warehouse is required");
    const qty = type === "entry" ? Math.abs(qtyRaw) : -Math.abs(qtyRaw);
    const { error } = await supabase.from("inventory_movements").insert({
      product_id,
      warehouse_id,
      qty,
      reason_id: reason.id,
      note,
    });
    if (error) throw error;
    revalidatePath("/movements");
    redirect("/movements");
  }
}

export default async function NewMovementPage() {
  const { products, warehouses, reasons } = await getFormData();
  const productOptions = (products ?? []).map((p: any) => ({ value: p.id, label: `${p.sku} - ${p.name}` }));
  const warehouseOptions = (warehouses ?? []).map((w: any) => ({ value: w.id, label: `${w.code} - ${w.name}` }));

  return (
    <div className="max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">New Movement</h1>

      <form action={createMovementAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <select id="type" name="type" className="border rounded px-3 py-2 w-full">
            <option value="entry">Entry</option>
            <option value="exit">Exit</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product_id">Product</Label>
          <SearchableSelect id="product_id" name="product_id" options={productOptions} required className="w-full" placeholder="Search product..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="warehouse_id">Warehouse</Label>
            <SearchableSelect id="warehouse_id" name="warehouse_id" options={warehouseOptions} required className="w-full" placeholder="Search warehouse..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to_warehouse_id">To Warehouse (Transfer)</Label>
            <SearchableSelect id="to_warehouse_id" name="to_warehouse_id" options={warehouseOptions} className="w-full" placeholder="Search destination..." />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="qty">Quantity</Label>
            <Input id="qty" name="qty" type="number" step="0.01" min="0" defaultValue={1} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason_code">Reason</Label>
            <select id="reason_code" name="reason_code" className="border rounded px-3 py-2 w-full">
              {reasons.map((r: any) => (
                <option key={r.id} value={r.code}>{r.code}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <Input id="note" name="note" />
        </div>

        <div className="flex gap-3">
          <SubmitButton pendingText="Saving...">Create</SubmitButton>
        </div>
      </form>

      <p className="text-sm text-muted-foreground">Nota: En transfer, se crearán automáticamente dos movimientos (salida y entrada).</p>
    </div>
  );
}

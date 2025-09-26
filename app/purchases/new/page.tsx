import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

async function getFormData() {
  const supabase = await createClient();
  const [{ data: suppliers }, { data: warehouses }] = await Promise.all([
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("warehouses").select("id, code, name").eq("is_active", true).order("name"),
  ]);
  return { suppliers: suppliers ?? [], warehouses: warehouses ?? [] };
}

async function createPurchaseAction(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const supplier_id = String(formData.get("supplier_id") || "");
  const warehouse_id = String(formData.get("warehouse_id") || "");
  const currency = String(formData.get("currency") || "MXN");
  const notes = String(formData.get("notes") || "");

  if (!supplier_id) throw new Error("Supplier is required");
  if (!warehouse_id) throw new Error("Warehouse is required");

  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({ supplier_id, warehouse_id, currency, notes, status: "OPEN" })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/purchases");
  redirect(`/purchases/${data.id}`);
}

export default async function NewPurchasePage() {
  const { suppliers, warehouses } = await getFormData();

  return (
    <div className="max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">New Purchase Order</h1>

      <form action={createPurchaseAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="supplier_id">Supplier</Label>
          <select id="supplier_id" name="supplier_id" required className="border rounded px-3 py-2 w-full">
            <option value="">Select supplier</option>
            {suppliers.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="warehouse_id">Warehouse</Label>
          <select id="warehouse_id" name="warehouse_id" required className="border rounded px-3 py-2 w-full">
            <option value="">Select warehouse</option>
            {warehouses.map((w: any) => (
              <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" name="currency" defaultValue="MXN" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" />
          </div>
        </div>

        <div className="flex gap-3">
          <SubmitButton pendingText="Creating...">Create</SubmitButton>
        </div>
      </form>
    </div>
  );
}

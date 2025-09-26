import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

async function getFormData() {
  const supabase = await createClient();
  const [{ data: customers }, { data: warehouses }] = await Promise.all([
    supabase.from("customers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("warehouses").select("id, code, name").eq("is_active", true).order("name"),
  ]);
  return { customers: customers ?? [], warehouses: warehouses ?? [] };
}

async function createSalesAction(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const customer_id = String(formData.get("customer_id") || "");
  const warehouse_id = String(formData.get("warehouse_id") || "");
  const currency = String(formData.get("currency") || "MXN");
  const notes = String(formData.get("notes") || "");

  if (!warehouse_id) throw new Error("Warehouse is required");

  const { data, error } = await supabase
    .from("sales_orders")
    .insert({ customer_id: customer_id || null, warehouse_id, currency, notes, status: "OPEN" })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/sales");
  redirect(`/sales/${data.id}`);
}

export default async function NewSalesPage() {
  const { customers, warehouses } = await getFormData();

  return (
    <div className="max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">New Sales Order</h1>

      <form action={createSalesAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="customer_id">Customer</Label>
          <select id="customer_id" name="customer_id" className="border rounded px-3 py-2 w-full">
            <option value="">Select customer (optional)</option>
            {customers.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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

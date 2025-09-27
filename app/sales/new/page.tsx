import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

type Customer = {
  id: string;
  name: string;
};

type Warehouse = {
  id: string;
  code: string;
  name: string;
};

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
    <div className="max-w-xl p-3 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-semibold">Nueva Orden de Venta</h1>

      <form action={createSalesAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="customer_id">Cliente</Label>
          <select id="customer_id" name="customer_id" className="border rounded px-3 py-2 w-full text-base">
            <option value="">Seleccionar cliente (opcional)</option>
            {customers.map((c: Customer) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="warehouse_id">Almacén</Label>
          <select id="warehouse_id" name="warehouse_id" required className="border rounded px-3 py-2 w-full text-base">
            <option value="">Seleccionar almacén</option>
            {warehouses.map((w: Warehouse) => (
              <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="currency">Moneda</Label>
            <Input id="currency" name="currency" defaultValue="MXN" className="text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Input id="notes" name="notes" className="text-base" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <SubmitButton pendingText="Creando...">Crear Orden</SubmitButton>
        </div>
      </form>
    </div>
  );
}

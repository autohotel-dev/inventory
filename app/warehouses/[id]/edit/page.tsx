import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function getWarehouse(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .select("id, code, name, address, is_active")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function updateWarehouseAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  const payload = {
    code: String(formData.get("code") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    is_active: formData.get("is_active") === "on",
  };
  const { error } = await supabase.from("warehouses").update(payload).eq("id", id);
  if (error) throw error;
  revalidatePath("/warehouses");
  redirect("/warehouses");
}

export default async function EditWarehousePage({ params }: { params: { id: string } }) {
  const warehouse = await getWarehouse(params.id).catch(() => null);
  if (!warehouse) return notFound();

  return (
    <div className="max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Edit Warehouse</h1>

      <form action={updateWarehouseAction} className="space-y-4">
        <input type="hidden" name="id" defaultValue={warehouse.id} />
        <div className="space-y-2">
          <Label htmlFor="code">Code</Label>
          <Input id="code" name="code" required defaultValue={warehouse.code ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required defaultValue={warehouse.name ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" name="address" defaultValue={warehouse.address ?? ""} />
        </div>
        <div className="flex items-center gap-2">
          <input id="is_active" name="is_active" type="checkbox" defaultChecked={!!warehouse.is_active} />
          <Label htmlFor="is_active">Active</Label>
        </div>

        <div className="flex gap-3">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function getSupplier(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, tax_id, email, phone, address, is_active")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function updateSupplierAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  const payload = {
    name: String(formData.get("name") || "").trim(),
    tax_id: String(formData.get("tax_id") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    is_active: formData.get("is_active") === "on",
  };
  const { error } = await supabase.from("suppliers").update(payload).eq("id", id);
  if (error) throw error;
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export default async function EditSupplierPage({ params }: { params: { id: string } }) {
  const supplier = await getSupplier(params.id).catch(() => null);
  if (!supplier) return notFound();

  return (
    <div className="max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Edit Supplier</h1>

      <form action={updateSupplierAction} className="space-y-4">
        <input type="hidden" name="id" defaultValue={supplier.id} />
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required defaultValue={supplier.name ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tax_id">Tax ID</Label>
            <Input id="tax_id" name="tax_id" defaultValue={supplier.tax_id ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={supplier.phone ?? ""} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={supplier.email ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" name="address" defaultValue={supplier.address ?? ""} />
        </div>
        <div className="flex items-center gap-2">
          <input id="is_active" name="is_active" type="checkbox" defaultChecked={!!supplier.is_active} />
          <Label htmlFor="is_active">Active</Label>
        </div>

        <div className="flex gap-3">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  );
}

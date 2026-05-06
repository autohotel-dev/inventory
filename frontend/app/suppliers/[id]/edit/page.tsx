import { apiClient } from "@/lib/api/client";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function getSupplier(id: string) {
  const { data } = await apiClient.get(`/system/crud/suppliers/${id}`) as any;
  if (!data) throw new Error("Supplier not found");
  return data;
}

async function updateSupplierAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const payload = {
    name: String(formData.get("name") || "").trim(),
    tax_id: String(formData.get("tax_id") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    is_active: formData.get("is_active") === "on",
  };
  try {
    await apiClient.patch(`/system/crud/suppliers/${id}`, payload);
  } catch (error) {
    throw error;
  }
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const supplier = await getSupplier(resolvedParams.id).catch(() => null);
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

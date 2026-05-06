import { apiClient } from "@/lib/api/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

async function createSupplierAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const tax_id = String(formData.get("tax_id") || "").trim();

  const payload = {
    name,
    tax_id,
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    is_active: formData.get("is_active") === "on",
  };

  try {
    await apiClient.post("/system/crud/suppliers", payload);
  } catch (error: any) {
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail;
      if (typeof detail === 'string' && detail.includes("23505")) {
        throw new Error("Ya existe un proveedor con estos datos. Verifica que no esté duplicado.");
      }
      if (typeof detail === 'string' && detail.includes("23502")) {
        throw new Error("Faltan campos requeridos. Asegúrate de llenar el Nombre.");
      }
    }
    throw new Error(`Error al registrar proveedor: ${error.message}`);
  }

  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export default function NewSupplierPage() {
  return (
    <div className="max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">New Supplier</h1>

      <form action={createSupplierAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tax_id">Tax ID</Label>
            <Input id="tax_id" name="tax_id" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" name="address" />
        </div>
        <div className="flex items-center gap-2">
          <input id="is_active" name="is_active" type="checkbox" defaultChecked />
          <Label htmlFor="is_active">Active</Label>
        </div>

        <div className="flex gap-3">
          <SubmitButton pendingText="Creating...">Create</SubmitButton>
        </div>
      </form>
    </div>
  );
}

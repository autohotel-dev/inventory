import { apiClient } from "@/lib/api/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

async function createWarehouseAction(formData: FormData) {
  "use server";
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();

  const payload = {
    code,
    name,
    address: String(formData.get("address") || "").trim(),
    is_active: formData.get("is_active") === "on",
  };

  try {
    await apiClient.post("/system/crud/warehouses", payload);
  } catch (error: any) {
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail;
      if (typeof detail === 'string' && detail.includes("23505")) {
        throw new Error("Ya existe un almacén con estos datos. Verifica que no esté duplicado.");
      }
      if (typeof detail === 'string' && detail.includes("23502")) {
        throw new Error("Faltan campos requeridos. Asegúrate de llenar Código y Nombre.");
      }
    }
    throw new Error(`Error al registrar almacén: ${error.message}`);
  }

  revalidatePath("/warehouses");
  redirect("/warehouses");
}

export default function NewWarehousePage() {
  return (
    <div className="max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">New Warehouse</h1>

      <form action={createWarehouseAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">Code</Label>
          <Input id="code" name="code" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
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

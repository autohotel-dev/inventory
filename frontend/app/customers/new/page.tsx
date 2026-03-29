import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function createCustomerAction(formData: FormData) {
  "use server";
  const supabase = await createClient();
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

  const { error } = await supabase.from("customers").insert(payload);

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("tax_id")) {
        throw new Error(`Ya existe un cliente con el RFC "${tax_id}". Verifica que no esté duplicado.`);
      }
      if (error.message.includes("name")) {
        throw new Error(`Ya existe un cliente con el nombre "${name}".`);
      }
      throw new Error("Ya existe un cliente con estos datos. Verifica que no esté duplicado.");
    }
    if (error.code === "23502") {
      throw new Error("Faltan campos requeridos. Asegúrate de llenar el Nombre.");
    }
    throw new Error(`Error al registrar cliente: ${error.message}`);
  }

  revalidatePath("/customers");
  redirect("/customers");
}

export default function NewCustomerPage() {
  return (
    <div className="max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">New Customer</h1>

      <form action={createCustomerAction} className="space-y-4">
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
          <Button type="submit">Create</Button>
        </div>
      </form>
    </div>
  );
}

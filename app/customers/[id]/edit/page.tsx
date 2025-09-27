import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function getCustomer(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, tax_id, email, phone, address, is_active")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function updateCustomerAction(formData: FormData) {
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
  const { error } = await supabase.from("customers").update(payload).eq("id", id);
  if (error) throw error;
  revalidatePath("/customers");
  redirect("/customers");
}

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const customer = await getCustomer(resolvedParams.id).catch(() => null);
  if (!customer) return notFound();

  return (
    <div className="max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Edit Customer</h1>

      <form action={updateCustomerAction} className="space-y-4">
        <input type="hidden" name="id" defaultValue={customer.id} />
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required defaultValue={customer.name ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tax_id">Tax ID</Label>
            <Input id="tax_id" name="tax_id" defaultValue={customer.tax_id ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={customer.phone ?? ""} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={customer.email ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" name="address" defaultValue={customer.address ?? ""} />
        </div>
        <div className="flex items-center gap-2">
          <input id="is_active" name="is_active" type="checkbox" defaultChecked={!!customer.is_active} />
          <Label htmlFor="is_active">Active</Label>
        </div>

        <div className="flex gap-3">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  );
}

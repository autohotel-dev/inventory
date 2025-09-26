import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

async function createProductAction(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const payload = {
    sku: String(formData.get("sku") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    price: Number(formData.get("price") || 0),
    min_stock: Number(formData.get("min_stock") || 0),
    is_active: formData.get("is_active") === "on",
  };

  const { error } = await supabase.from("products").insert(payload);
  if (error) throw error;
  revalidatePath("/products");
  redirect("/products");
}

export default function NewProductPage() {
  return (
    <div className="max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">New Product</h1>

      <form action={createProductAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Price</Label>
            <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min_stock">Min Stock</Label>
            <Input id="min_stock" name="min_stock" type="number" step="1" min="0" defaultValue={0} />
          </div>
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

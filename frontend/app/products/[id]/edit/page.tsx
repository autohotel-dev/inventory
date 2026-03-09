import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function getProduct(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, price, min_stock, is_active")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function updateProductAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  const payload = {
    sku: String(formData.get("sku") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    price: Number(formData.get("price") || 0),
    min_stock: Number(formData.get("min_stock") || 0),
    is_active: formData.get("is_active") === "on",
  };
  const { error } = await supabase.from("products").update(payload).eq("id", id);
  if (error) throw error;
  revalidatePath("/products");
  redirect("/products");
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const product = await getProduct(resolvedParams.id).catch(() => null);
  if (!product) return notFound();

  return (
    <div className="max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Edit Product</h1>

      <form action={updateProductAction} className="space-y-4">
        <input type="hidden" name="id" defaultValue={product.id} />
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" required defaultValue={product.sku ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required defaultValue={product.name ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Price</Label>
            <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={product.price ?? 0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min_stock">Min Stock</Label>
            <Input id="min_stock" name="min_stock" type="number" step="1" min="0" defaultValue={product.min_stock ?? 0} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input id="is_active" name="is_active" type="checkbox" defaultChecked={!!product.is_active} />
          <Label htmlFor="is_active">Active</Label>
        </div>

        <div className="flex gap-3">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  );
}

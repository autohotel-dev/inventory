import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product-form";

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
      <h1 className="text-2xl font-semibold">Nuevo Producto</h1>
      <ProductForm action={createProductAction} />
    </div>
  );
}

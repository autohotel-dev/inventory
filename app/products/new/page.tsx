import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product-form";

async function createProductAction(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const sku = String(formData.get("sku") || "").trim();
  const name = String(formData.get("name") || "").trim();

  const payload = {
    sku,
    name,
    price: Number(formData.get("price") || 0),
    min_stock: Number(formData.get("min_stock") || 0),
    is_active: formData.get("is_active") === "on",
  };

  const { error } = await supabase.from("products").insert(payload);

  if (error) {
    // Manejar errores específicos
    if (error.code === "23505") {
      // Violación de unique constraint
      if (error.message.includes("sku")) {
        throw new Error(`El SKU "${sku}" ya está registrado. Por favor usa un SKU diferente.`);
      }
      throw new Error(`Ya existe un producto con estos datos. Verifica que no esté duplicado.`);
    }
    if (error.code === "23502") {
      // Campo requerido nulo
      throw new Error("Faltan campos requeridos. Asegúrate de llenar SKU y Nombre.");
    }
    // Error genérico con más detalle
    throw new Error(`Error al registrar producto: ${error.message}`);
  }

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

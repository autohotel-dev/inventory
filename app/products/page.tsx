import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";

export const dynamic = "force-dynamic";

async function getProducts({ q, page, pageSize }: { q?: string; page: number; pageSize: number }) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("products")
    .select("id, sku, name, price, min_stock, is_active", { count: "exact" })
    .order("created_at", { ascending: false });

  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    query = query.or(`sku.ilike.${like},name.ilike.${like}`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

async function deleteProductAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/products");
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const q = params?.q ?? "";
  const page = Math.max(1, Number(params?.page ?? 1));
  const pageSize = 10;
  const { rows: products, count } = await getProducts({ q, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <Button asChild>
          <Link href="/products/new">Nuevo Producto</Link>
        </Button>
      </div>

      <form className="flex gap-2" action="/products" method="get">
        <input
          type="text"
          name="q"
          placeholder="Buscar por SKU o Nombre"
          defaultValue={q}
          className="border rounded px-3 py-2 w-full max-w-md"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">SKU</th>
              <th className="text-left p-3">Nombre</th>
              <th className="text-right p-3">Precio</th>
              <th className="text-right p-3">Stock Mín</th>
              <th className="text-center p-3">Activo</th>
              <th className="text-right p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.sku}</td>
                <td className="p-3">{p.name}</td>
                <td className="p-3 text-right">{Number(p.price ?? 0).toFixed(2)}</td>
                <td className="p-3 text-right">{Number(p.min_stock ?? 0)}</td>
                <td className="p-3 text-center">{p.is_active ? "✅" : "❌"}</td>
                <td className="p-3">
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" asChild>
                      <Link href={`/products/${p.id}/edit`}>Editar</Link>
                    </Button>
                    <form action={deleteProductAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton confirmText="¿Eliminar este producto?" variant="destructive" type="submit">Eliminar</ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No hay productos aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Total: {count}</div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild disabled={page <= 1}>
            <Link href={`/products?${new URLSearchParams({ q, page: String(page - 1) }).toString()}`}>Anterior</Link>
          </Button>
          <span className="text-sm">Página {page} / {totalPages}</span>
          <Button variant="secondary" asChild disabled={page >= totalPages}>
            <Link href={`/products?${new URLSearchParams({ q, page: String(page + 1) }).toString()}`}>Siguiente</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

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

export default async function ProductsPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const q = searchParams?.q ?? "";
  const page = Math.max(1, Number(searchParams?.page ?? 1));
  const pageSize = 10;
  const { rows: products, count } = await getProducts({ q, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Button asChild>
          <Link href="/products/new">New Product</Link>
        </Button>
      </div>

      <form className="flex gap-2" action="/products" method="get">
        <input
          type="text"
          name="q"
          placeholder="Search by SKU or Name"
          defaultValue={q}
          className="border rounded px-3 py-2 w-full max-w-md"
        />
        <Button type="submit">Search</Button>
      </form>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">SKU</th>
              <th className="text-left p-3">Name</th>
              <th className="text-right p-3">Price</th>
              <th className="text-right p-3">Min Stock</th>
              <th className="text-center p-3">Active</th>
              <th className="text-right p-3">Actions</th>
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
                      <Link href={`/products/${p.id}/edit`}>Edit</Link>
                    </Button>
                    <form action={deleteProductAction} onSubmit={(e) => {
                      if (!confirm("Delete this product?")) e.preventDefault();
                    }}>
                      <input type="hidden" name="id" value={p.id} />
                      <Button variant="destructive" type="submit">Delete</Button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No products yet.
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
            <Link href={`/products?${new URLSearchParams({ q, page: String(page - 1) }).toString()}`}>Prev</Link>
          </Button>
          <span className="text-sm">Page {page} / {totalPages}</span>
          <Button variant="secondary" asChild disabled={page >= totalPages}>
            <Link href={`/products?${new URLSearchParams({ q, page: String(page + 1) }).toString()}`}>Next</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

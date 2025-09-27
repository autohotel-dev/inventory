import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { DeleteWarehouseForm } from "@/components/delete-warehouse-form";

export const dynamic = "force-dynamic";

async function getWarehouses({ q, page, pageSize }: { q?: string; page: number; pageSize: number }) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("warehouses")
    .select("id, code, name, address, is_active", { count: "exact" })
    .order("created_at", { ascending: false });

  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    query = query.or(`code.ilike.${like},name.ilike.${like},address.ilike.${like}`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

async function deleteWarehouseAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("warehouses").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/warehouses");
}

export default async function WarehousesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const q = params?.q ?? "";
  const page = Math.max(1, Number(params?.page ?? 1));
  const pageSize = 10;
  const { rows: warehouses, count } = await getWarehouses({ q, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Warehouses</h1>
        <Button asChild>
          <Link href="/warehouses/new">New Warehouse</Link>
        </Button>
      </div>

      <form className="flex gap-2" action="/warehouses" method="get">
        <input
          type="text"
          name="q"
          placeholder="Search by Code, Name or Address"
          defaultValue={q}
          className="border rounded px-3 py-2 w-full max-w-md"
        />
        <Button type="submit">Search</Button>
      </form>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Address</th>
              <th className="text-center p-3">Active</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id} className="border-t">
                <td className="p-3">{w.code}</td>
                <td className="p-3">{w.name}</td>
                <td className="p-3">{w.address}</td>
                <td className="p-3 text-center">{w.is_active ? "✅" : "❌"}</td>
                <td className="p-3">
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" asChild>
                      <Link href={`/warehouses/${w.id}/edit`}>Edit</Link>
                    </Button>
                    <DeleteWarehouseForm 
                      warehouseId={w.id} 
                      deleteAction={deleteWarehouseAction} 
                    />
                  </div>
                </td>
              </tr>
            ))}
            {warehouses.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No warehouses yet.
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
            <Link href={`/warehouses?${new URLSearchParams({ q, page: String(page - 1) }).toString()}`}>Prev</Link>
          </Button>
          <span className="text-sm">Page {page} / {totalPages}</span>
          <Button variant="secondary" asChild disabled={page >= totalPages}>
            <Link href={`/warehouses?${new URLSearchParams({ q, page: String(page + 1) }).toString()}`}>Next</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

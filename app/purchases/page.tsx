import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getPurchaseOrders({ q, status, page, pageSize }: { q?: string; status?: string; page: number; pageSize: number }) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("purchase_orders")
    .select([
      "id",
      "created_at",
      "status",
      "currency",
      "subtotal",
      "tax",
      "total",
      "suppliers:supplier_id(name)",
      "warehouses:warehouse_id(code, name)"
    ].join(","), { count: "exact" })
    .order("created_at", { ascending: false });

  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    // filter by supplier name via text search on joined column is not supported directly; use textSearch only on base fields.
    // As a workaround, we can filter by status above and leave supplier name search to a separate endpoint.
    // Alternatively, fetch all page and filter client-side; here we skip supplier name search to keep it server-only.
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

export default async function PurchasesPage({ searchParams }: { searchParams: { q?: string; status?: string; page?: string } }) {
  const q = searchParams?.q ?? "";
  const status = searchParams?.status ?? "ALL";
  const page = Math.max(1, Number(searchParams?.page ?? 1));
  const pageSize = 10;
  const { rows: orders, count } = await getPurchaseOrders({ q, status, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Purchase Orders</h1>
        <Button asChild>
          <Link href="/purchases/new">New Purchase</Link>
        </Button>
      </div>

      <form className="flex flex-wrap gap-2 items-center" action="/purchases" method="get">
        <input
          type="text"
          name="q"
          placeholder="Search (supplier name - not server filtered)"
          defaultValue={q}
          className="border rounded px-3 py-2 w-full max-w-md"
        />
        <select name="status" defaultValue={status} className="border rounded px-3 py-2">
          <option value="ALL">All</option>
          <option value="OPEN">OPEN</option>
          <option value="RECEIVED">RECEIVED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
        <Button type="submit">Filter</Button>
      </form>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Supplier</th>
              <th className="text-left p-3">Warehouse</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Subtotal</th>
              <th className="text-right p-3">Tax</th>
              <th className="text-right p-3">Total</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o: any) => (
              <tr key={o.id} className="border-t">
                <td className="p-3">{new Date(o.created_at).toLocaleString()}</td>
                <td className="p-3">{o.suppliers?.name}</td>
                <td className="p-3">{o.warehouses?.code} - {o.warehouses?.name}</td>
                <td className="p-3">{o.status}</td>
                <td className="p-3 text-right">{Number(o.subtotal || 0).toFixed(2)} {o.currency}</td>
                <td className="p-3 text-right">{Number(o.tax || 0).toFixed(2)} {o.currency}</td>
                <td className="p-3 text-right font-medium">{Number(o.total || 0).toFixed(2)} {o.currency}</td>
                <td className="p-3 text-right">
                  <Button variant="secondary" asChild>
                    <Link href={`/purchases/${o.id}`}>Open</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">No purchase orders yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Total: {count}</div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild disabled={page <= 1}>
            <Link href={`/purchases?${new URLSearchParams({ q, status, page: String(page - 1) }).toString()}`}>Prev</Link>
          </Button>
          <span className="text-sm">Page {page} / {totalPages}</span>
          <Button variant="secondary" asChild disabled={page >= totalPages}>
            <Link href={`/purchases?${new URLSearchParams({ q, status, page: String(page + 1) }).toString()}`}>Next</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

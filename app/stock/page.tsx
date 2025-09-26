import { createClient } from "@/lib/supabase/server";

interface Stock {
  product_id: string;
  sku: string;
  name: string;
  qty_total: number;
}

export const dynamic = "force-dynamic";

async function getStockByProduct() {
  const supabase = await createClient();
  // Aggregate directly in query in case the DB view doesn't exist
  const { data, error } = await supabase
    .from("stock")
    .select("product_id, qty, products:product_id(sku, name)")
    .limit(100000); // large cap; Supabase will paginate server-side
  if (error) throw error;
  type Row = { product_id: string; qty: number | string | null; products?: { sku?: string | null; name?: string | null } | null };
  const rows = (data ?? []) as unknown as Row[];
  const map = new Map<string, Stock>();
  for (const row of rows) {
    const key = String(row.product_id);
    const prev: Stock = map.get(key) ?? {
      product_id: key,
      sku: String(row.products?.sku ?? ""),
      name: String(row.products?.name ?? ""),
      qty_total: 0,
    };
    prev.qty_total += Number(row.qty ?? 0);
    map.set(key, prev);
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default async function StockPage() {
  const rows = await getStockByProduct();
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Stock by Product</h1>
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">SKU</th>
              <th className="text-left p-3">Product</th>
              <th className="text-right p-3">Qty Total</th>
              <th className="text-left p-3">Kardex</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product_id} className="border-t">
                <td className="p-3">{r.sku}</td>
                <td className="p-3">{r.name}</td>
                <td className="p-3 text-right">{Number(r.qty_total).toFixed(2)}</td>
                <td className="p-3">
                  <a className="text-primary underline" href={`/kardex?productId=${r.product_id}`}>View Kardex</a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">No stock yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

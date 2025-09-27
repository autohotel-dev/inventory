import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type KardexRow = {
  id: string;
  created_at: string;
  qty: number | null;
  warehouses?: { code?: string | null; name?: string | null } | null;
  movement_reasons?: { code?: string | null } | null;
  reference_table?: string | null;
  reference_id?: string | null;
  note?: string | null;
  balance?: number;
};

export const dynamic = "force-dynamic";

async function getKardex(productId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_movements")
    .select(
      [
        "id",
        "created_at",
        "qty",
        "reference_table",
        "reference_id",
        "note",
        "warehouses:warehouse_id(name, code)",
        "movement_reasons:reason_id(code)"
      ].join(",")
    )
    .eq("product_id", productId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export default async function KardexPage({ searchParams }: { searchParams: Promise<{ productId?: string }> }) {
  const params = await searchParams;
  const productId = params?.productId;
  if (!productId) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Kardex</h1>
        <p>Provide a product via <code>?productId=UUID</code>. Tip: Go to <Link className="text-primary underline" href="/stock">Stock</Link> and click on "View Kardex".</p>
      </div>
    );
  }

  const rows = await getKardex(productId);
  let running = 0;
  const enriched = (rows as unknown[]).map((r: unknown) => {
    const row = r as KardexRow;
    running += Number(row.qty || 0);
    return { ...row, balance: running };
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kardex</h1>
        <Link className="text-primary underline" href="/stock">Back to Stock</Link>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Warehouse</th>
              <th className="text-left p-3">Reason</th>
              <th className="text-right p-3">Qty</th>
              <th className="text-right p-3">Balance</th>
              <th className="text-left p-3">Reference</th>
              <th className="text-left p-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((m: KardexRow & { balance: number }) => (
              <tr key={m.id} className="border-t">
                <td className="p-3">{new Date(m.created_at).toLocaleString()}</td>
                <td className="p-3">{m.warehouses?.code} - {m.warehouses?.name}</td>
                <td className="p-3">{m.movement_reasons?.code}</td>
                <td className="p-3 text-right">{Number(m.qty).toFixed(2)}</td>
                <td className="p-3 text-right">{Number(m.balance).toFixed(2)}</td>
                <td className="p-3">{m.reference_table ?? ""} {m.reference_id ?? ""}</td>
                <td className="p-3">{m.note ?? ""}</td>
              </tr>
            ))}
            {enriched.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No movements for this product.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getMovements() {
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
        "products:product_id(name, sku)",
        "warehouses:warehouse_id(name, code)",
        "movement_reasons:reason_id(code)"
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export default async function MovementsPage() {
  const movements = await getMovements();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory Movements</h1>
        <Button asChild>
          <Link href="/movements/new">New Movement</Link>
        </Button>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Product</th>
              <th className="text-left p-3">Warehouse</th>
              <th className="text-left p-3">Reason</th>
              <th className="text-right p-3">Qty</th>
              <th className="text-left p-3">Reference</th>
              <th className="text-left p-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m: any) => (
              <tr key={m.id} className="border-t">
                <td className="p-3">{new Date(m.created_at).toLocaleString()}</td>
                <td className="p-3">{m.products?.sku} - {m.products?.name}</td>
                <td className="p-3">{m.warehouses?.code} - {m.warehouses?.name}</td>
                <td className="p-3">{m.movement_reasons?.code}</td>
                <td className="p-3 text-right">{Number(m.qty).toFixed(2)}</td>
                <td className="p-3">{m.reference_table ?? ""} {m.reference_id ?? ""}</td>
                <td className="p-3">{m.note ?? ""}</td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No movements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

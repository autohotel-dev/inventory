import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function getSalesOrders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_orders")
    .select([
      "id",
      "created_at",
      "status",
      "currency",
      "subtotal",
      "tax",
      "total",
      "customers:customer_id(name)",
      "warehouses:warehouse_id(code, name)"
    ].join(","))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export default async function SalesPage() {
  const orders = await getSalesOrders();
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sales Orders</h1>
        <Button asChild>
          <Link href="/sales/new">New Sale</Link>
        </Button>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Customer</th>
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
                <td className="p-3">{o.customers?.name}</td>
                <td className="p-3">{o.warehouses?.code} - {o.warehouses?.name}</td>
                <td className="p-3">{o.status}</td>
                <td className="p-3 text-right">{Number(o.subtotal || 0).toFixed(2)} {o.currency}</td>
                <td className="p-3 text-right">{Number(o.tax || 0).toFixed(2)} {o.currency}</td>
                <td className="p-3 text-right font-medium">{Number(o.total || 0).toFixed(2)} {o.currency}</td>
                <td className="p-3 text-right">
                  <Button variant="secondary" asChild>
                    <Link href={`/sales/${o.id}`}>Open</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">No sales orders yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

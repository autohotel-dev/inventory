import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const supabase = await createClient();

  // Products active count
  const { count: productsCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  // Total stock qty (sum)
  const { data: stockRows } = await supabase
    .from("stock")
    .select("qty")
    .limit(100000);
  const totalStock = (stockRows ?? []).reduce((a: number, r: { qty: number | null }) => a + Number(r.qty || 0), 0);

  // Open orders
  const { count: poOpen } = await supabase
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "OPEN");
  const { count: soOpen } = await supabase
    .from("sales_orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "OPEN");

  // Last movements
  const { data: lastMoves } = await supabase
    .from("inventory_movements")
    .select("created_at, qty, products:product_id(sku, name), warehouses:warehouse_id(code, name)")
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    productsCount: productsCount ?? 0,
    totalStock,
    poOpen: poOpen ?? 0,
    soOpen: soOpen ?? 0,
    lastMoves: lastMoves ?? [],
  };
}

export default async function Home() {
  const { productsCount, totalStock, poOpen, soOpen, lastMoves } = await getDashboardData();

  const quickLinks = [
    { href: "/products/new", label: "Nuevo Producto" },
    { href: "/purchases/new", label: "Nueva Compra" },
    { href: "/sales/new", label: "Nueva Venta" },
    { href: "/movements/new", label: "Nuevo Movimiento" },
  ];

  const modules = [
    { href: "/products", label: "Productos" },
    { href: "/categories", label: "Categorías" },
    { href: "/warehouses", label: "Almacenes" },
    { href: "/suppliers", label: "Proveedores" },
    { href: "/customers", label: "Clientes" },
    { href: "/movements", label: "Movimientos" },
    { href: "/stock", label: "Stock" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="border rounded p-4 bg-card">
          <div className="text-sm text-muted-foreground">Productos</div>
          <div className="text-xl md:text-2xl font-semibold">{productsCount}</div>
        </div>
        <div className="border rounded p-4 bg-card">
          <div className="text-sm text-muted-foreground">Stock Total</div>
          <div className="text-xl md:text-2xl font-semibold">{totalStock.toFixed(0)}</div>
        </div>
        <div className="border rounded p-4 bg-card">
          <div className="text-sm text-muted-foreground">Compras Abiertas</div>
          <div className="text-xl md:text-2xl font-semibold">{poOpen}</div>
        </div>
        <div className="border rounded p-4 bg-card">
          <div className="text-sm text-muted-foreground">Ventas Abiertas</div>
          <div className="text-xl md:text-2xl font-semibold">{soOpen}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Últimos Movimientos</h2>
          <div className="table-responsive border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Product</th>
                  <th className="text-left p-3">Warehouse</th>
                  <th className="text-right p-3">Qty</th>
                </tr>
              </thead>
              <tbody>
                {lastMoves.map((m: Record<string, unknown>, idx: number) => (
                  <tr key={idx} className="border-t">
                    <td className="p-3">{new Date(m.created_at as string).toLocaleString()}</td>
                    <td className="p-3">{(m.products as any)?.sku} - {(m.products as any)?.name}</td>
                    <td className="p-3">{(m.warehouses as any)?.code} - {(m.warehouses as any)?.name}</td>
                    <td className="p-3 text-right">{Number(m.qty).toFixed(2)}</td>
                  </tr>
                ))}
                {lastMoves.length === 0 && (
                  <tr>
                    <td className="p-6 text-center text-muted-foreground" colSpan={4}>No movements</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Acciones Rápidas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickLinks.map((l) => (
              <Link key={l.href} href={l.href} className="border rounded p-4 hover:bg-muted transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
          <h2 className="text-lg font-semibold mt-6">Módulos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {modules.map((l) => (
              <Link key={l.href} href={l.href} className="border rounded p-4 hover:bg-muted transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

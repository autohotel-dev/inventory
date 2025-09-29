import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  TrendingUp,
  ShoppingCart,
  Activity,
  RefreshCw,
  Plus,
  ArrowRight
} from "lucide-react";

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
    { href: "/products/new", label: "Nuevo Producto", icon: "📦" },
    { href: "/purchases/new", label: "Nueva Compra", icon: "🛒" },
    { href: "/sales/new", label: "Nueva Venta", icon: "💰" },
    { href: "/movements/new", label: "Nuevo Movimiento", icon: "📋" },
  ];

  const modules = [
    { href: "/products", label: "Productos", icon: "📦" },
    { href: "/categories", label: "Categorías", icon: "🏷️" },
    { href: "/warehouses", label: "Almacenes", icon: "🏪" },
    { href: "/suppliers", label: "Proveedores", icon: "🚚" },
    { href: "/customers", label: "Clientes", icon: "👥" },
    { href: "/movements", label: "Movimientos", icon: "📊" },
    { href: "/stock", label: "Stock", icon: "📦" },
    { href: "/analytics", label: "Analytics", icon: "📈" },
  ];

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Ejecutivo</h1>
          <p className="text-muted-foreground">
            Resumen completo de tu inventario y operaciones diarias
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/analytics" className="inline-flex items-center gap-2">
            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
              📈 Ver Analytics
              <ArrowRight className="h-3 w-3" />
            </Badge>
          </Link>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Activos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productsCount}</div>
            <p className="text-xs text-muted-foreground">
              Productos disponibles en catálogo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStock.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">
              Unidades en todos los almacenes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compras Abiertas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{poOpen}</div>
            <p className="text-xs text-muted-foreground">
              Órdenes pendientes de recibir
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Abiertas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{soOpen}</div>
            <p className="text-xs text-muted-foreground">
              Órdenes pendientes de entregar
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimos Movimientos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Últimos Movimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastMoves.length > 0 ? (
              <div className="space-y-3">
                {lastMoves.map((m: Record<string, unknown>, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">
                        {(m.products as any)?.sku} - {(m.products as any)?.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {(m.warehouses as any)?.code} - {new Date(m.created_at as string).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge
                      variant={Number(m.qty) > 0 ? "default" : "destructive"}
                      className="ml-2"
                    >
                      {Number(m.qty) > 0 ? '📈' : '📉'} {Math.abs(Number(m.qty)).toFixed(2)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay movimientos recientes</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acciones Rápidas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors group"
                >
                  <span className="text-2xl">{link.icon}</span>
                  <span className="font-medium group-hover:text-primary transition-colors">
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Módulos del Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Módulos del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {modules.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="flex flex-col items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors group text-center"
              >
                <span className="text-3xl">{module.icon}</span>
                <span className="font-medium group-hover:text-primary transition-colors">
                  {module.label}
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

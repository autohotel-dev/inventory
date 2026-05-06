import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Package,
    DollarSign,
    Activity,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    ShoppingCart,
    ArrowRight,
    Sparkles,
    Trophy,
    Boxes
} from "lucide-react";
import { formatCurrency } from "@/lib/export-utils";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface DashboardData {
    monthlyRevenue: number;
    monthlyRevenueGrowth: number;
    todaySales: number;
    todayOrders: number;
    criticalStockCount: number;
    topProducts: Array<{
        name: string;
        sku: string;
        sold: number;
        revenue: number;
    }>;
}

export function AnalyticsDashboardOverview() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        setLoading(true);
        const supabase = createClient();

        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

            // 1. Ingresos del mes actual
            const { data: currentMonthSales } = await supabase
                .from("sales_orders")
                .select("total")
                .gte("created_at", startOfMonth)
                .in("status", ["CLOSED", "ENDED"]);

            // 2. Ingresos del mes anterior (para comparar)
            const { data: lastMonthSales } = await supabase
                .from("sales_orders")
                .select("total")
                .gte("created_at", startOfLastMonth)
                .lte("created_at", endOfLastMonth)
                .in("status", ["CLOSED", "ENDED"]);

            // 3. Ventas de hoy
            const { data: todaySalesData } = await supabase
                .from("sales_orders")
                .select("total")
                .gte("created_at", startOfToday)
                .in("status", ["CLOSED", "ENDED"]);

            // 4. Stock crítico - Contar productos cuyo stock total esté por debajo de min_stock
            const { data: productsWithStock } = await supabase
                .from("products")
                .select(`
                    id,
                    min_stock,
                    stock:stock(qty)
                `)
                ;

            // Calcular cuántos productos tienen stock crítico (stock total < min_stock)
            let criticalStockCount = 0;
            productsWithStock?.forEach((product: any) => {
                const totalStock = product.stock?.reduce((sum: number, s: any) => sum + (s.qty || 0), 0) || 0;
                const minStock = product.min_stock || 0;
                if (totalStock < minStock) {
                    criticalStockCount++;
                }
            });

            // 5. Top productos del mes
            const { data: topItems } = await supabase
                .from("sales_order_items")
                .select(`
                    qty,
                    unit_price,
                    total,
                    product:products(name, sku, id)
                `)
                .gte("created_at", startOfMonth);

            // Procesar datos
            const currentRevenue = currentMonthSales?.reduce((sum: number, order: any) => sum + (order.total || 0), 0) || 0;
            const lastRevenue = lastMonthSales?.reduce((sum: number, order: any) => sum + (order.total || 0), 0) || 0;

            let growth = 0;
            if (lastRevenue > 0) {
                growth = ((currentRevenue - lastRevenue) / lastRevenue) * 100;
            } else if (currentRevenue > 0) {
                growth = 100;
            }

            const todayRevenue = todaySalesData?.reduce((sum: number, order: any) => sum + (order.total || 0), 0) || 0;
            const todayOrdersCount = todaySalesData?.length || 0;

            // Procesar Top Productos
            const productMap = new Map<string, any>();
            topItems?.forEach((item: any) => {
                const id = item.product?.id;
                if (!id) return;

                if (!productMap.has(id)) {
                    productMap.set(id, {
                        name: item.product?.name,
                        sku: item.product?.sku,
                        sold: 0,
                        revenue: 0
                    });
                }
                const prod = productMap.get(id);
                prod.sold += item.qty || 0;
                prod.revenue += item.total || ((item.qty || 0) * (item.unit_price || 0));
            });

            const topProducts = Array.from(productMap.values())
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);

            setData({
                monthlyRevenue: currentRevenue,
                monthlyRevenueGrowth: growth,
                todaySales: todayRevenue,
                todayOrders: todayOrdersCount,
                criticalStockCount: criticalStockCount,
                topProducts
            });

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!data) return null;

    // Medal colors for top products
    const medalColors = [
        "from-yellow-400 to-amber-500", // Gold
        "from-slate-300 to-slate-400",   // Silver
        "from-amber-600 to-amber-700",  // Bronze
        "from-primary/50 to-primary/30", // 4th
        "from-muted to-muted/50"         // 5th
    ];

    return (
        <div className="space-y-6">
            {/* KPI Cards con Gradientes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Ingresos Mensuales */}
                <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos (Mes)</CardTitle>
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                            <DollarSign className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.monthlyRevenue)}</div>
                        <div className="flex items-center text-xs pt-2">
                            {data.monthlyRevenueGrowth >= 0 ? (
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-0">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    +{data.monthlyRevenueGrowth.toFixed(1)}%
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-0">
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                    {data.monthlyRevenueGrowth.toFixed(1)}%
                                </Badge>
                            )}
                            <span className="ml-2 text-muted-foreground">vs mes anterior</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Ventas Hoy */}
                <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ventas Hoy</CardTitle>
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                            <Activity className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.todaySales)}</div>
                        <p className="text-xs text-muted-foreground pt-2 flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-blue-500" />
                            {data.todayOrders} órdenes completadas
                        </p>
                    </CardContent>
                </Card>

                {/* Pedidos Totales */}
                <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos Totales</CardTitle>
                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                            <Package className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12</div>
                        <p className="text-xs text-muted-foreground pt-2 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-purple-500" />
                            +2 desde ayer
                        </p>
                    </CardContent>
                </Card>

                {/* Stock Crítico */}
                <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Alertas Stock</CardTitle>
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                            <AlertTriangle className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.criticalStockCount}</div>
                        <p className="text-xs text-muted-foreground pt-2">
                            Productos con stock bajo
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Productos mejorado */}
                <Card className="lg:col-span-2 border-0 bg-gradient-to-br from-muted/30 to-transparent">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-400/20 to-amber-500/20">
                                <Trophy className="h-5 w-5 text-yellow-500" />
                            </div>
                            <div>
                                <CardTitle>Top Productos del Mes</CardTitle>
                                <p className="text-sm text-muted-foreground">Los más vendidos este período</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {data.topProducts.map((product, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${medalColors[index]} flex items-center justify-center text-white font-bold shadow-sm`}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <div className="font-medium group-hover:text-primary transition-colors">{product.name}</div>
                                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{product.sku}</code>
                                                <span>•</span>
                                                <span>{product.sold} vendidos</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-lg">{formatCurrency(product.revenue)}</div>
                                        <div className="text-xs text-muted-foreground">ingresos</div>
                                    </div>
                                </div>
                            ))}
                            {data.topProducts.length === 0 && (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                                        <Boxes className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <p className="text-muted-foreground font-medium">No hay datos de ventas este mes</p>
                                    <p className="text-sm text-muted-foreground/70 mt-1">Los productos más vendidos aparecerán aquí</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Navegación Rápida mejorada */}
                <Card className="border-0 bg-gradient-to-br from-muted/30 to-transparent">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Acciones Rápidas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <Link href="/sales" className="block">
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-transparent hover:from-blue-500/20 transition-all group cursor-pointer">
                                    <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                        <ShoppingCart className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium">Nueva Venta</div>
                                        <div className="text-xs text-muted-foreground">Crear orden de venta</div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </Link>

                            <Link href="/inventory" className="block">
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-transparent hover:from-orange-500/20 transition-all group cursor-pointer">
                                    <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                        <Package className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium">Inventario</div>
                                        <div className="text-xs text-muted-foreground">Gestionar stock</div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </Link>

                            <Button
                                onClick={fetchDashboardData}
                                variant="ghost"
                                className="w-full mt-2 h-12 bg-muted/50 hover:bg-muted"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Actualizar Datos
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


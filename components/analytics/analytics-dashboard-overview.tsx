import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Package,
    DollarSign,
    Activity,
    RefreshCw,
    BarChart3,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    ShoppingCart,
    ArrowRight
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

            // 4. Stock crítico
            const { count: criticalStock } = await supabase
                .from("products")
                .select("*", { count: 'exact', head: true })
                .lt("stock_quantity", 10); // Asumiendo 10 como umbral general, o usar min_stock_level si existe

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
            const currentRevenue = currentMonthSales?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
            const lastRevenue = lastMonthSales?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;

            let growth = 0;
            if (lastRevenue > 0) {
                growth = ((currentRevenue - lastRevenue) / lastRevenue) * 100;
            } else if (currentRevenue > 0) {
                growth = 100;
            }

            const todayRevenue = todaySalesData?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
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
                criticalStockCount: criticalStock || 0,
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

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Ingresos Mensuales */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos (Mes Actual)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.monthlyRevenue)}</div>
                        <div className="flex items-center text-xs text-muted-foreground pt-1">
                            {data.monthlyRevenueGrowth >= 0 ? (
                                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                            ) : (
                                <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                            )}
                            <span className={data.monthlyRevenueGrowth >= 0 ? "text-green-500" : "text-red-500"}>
                                {data.monthlyRevenueGrowth.toFixed(1)}%
                            </span>
                            <span className="ml-1">vs mes anterior</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Ventas Hoy */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.todaySales)}</div>
                        <p className="text-xs text-muted-foreground pt-1">
                            {data.todayOrders} órdenes completadas hoy
                        </p>
                    </CardContent>
                </Card>

                {/* Pedidos Totales (Placeholder por ahora/Total mes) */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pedidos Totales</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12</div>
                        <p className="text-xs text-muted-foreground pt-1">
                            +2 desde ayer
                        </p>
                    </CardContent>
                </Card>

                {/* Stock Crítico */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Alertas de Stock</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.criticalStockCount}</div>
                        <p className="text-xs text-muted-foreground pt-1">
                            Productos con stock bajo
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Productos */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Productos Top del Mes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.topProducts.map((product, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Badge variant="outline" className="w-8 h-8 flex items-center justify-center rounded-full">
                                            {index + 1}
                                        </Badge>
                                        <div>
                                            <div className="font-medium">{product.name}</div>
                                            <div className="text-sm text-muted-foreground">SKU: {product.sku}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold">{formatCurrency(product.revenue)}</div>
                                        <div className="text-sm text-muted-foreground">{product.sold} vendidos</div>
                                    </div>
                                </div>
                            ))}
                            {data.topProducts.length === 0 && (
                                <div className="text-center py-6 text-muted-foreground">
                                    No hay datos de ventas este mes
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Accesos Rápidos (Manteniendo la funcionalidad anterior pero mejorada) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Navegación Rápida</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Button variant="outline" className="w-full justify-start h-auto py-4" asChild>
                                <Link href="/sales">
                                    <ShoppingCart className="mr-4 h-5 w-5 bg-blue-100 text-blue-600 p-1 rounded" />
                                    <div className="text-left">
                                        <div className="font-medium">Nueva Venta</div>
                                        <div className="text-xs text-muted-foreground">Crear orden de venta</div>
                                    </div>
                                    <ArrowRight className="ml-auto h-4 w-4" />
                                </Link>
                            </Button>

                            <Button variant="outline" className="w-full justify-start h-auto py-4" asChild>
                                <Link href="/inventory">
                                    <Package className="mr-4 h-5 w-5 bg-orange-100 text-orange-600 p-1 rounded" />
                                    <div className="text-left">
                                        <div className="font-medium">Inventario</div>
                                        <div className="text-xs text-muted-foreground">Gestionar stock</div>
                                    </div>
                                    <ArrowRight className="ml-auto h-4 w-4" />
                                </Link>
                            </Button>

                            <Button onClick={fetchDashboardData} variant="ghost" className="w-full mt-2">
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

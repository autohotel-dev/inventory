"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users,
  Calendar,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PurchasesSalesCharts } from "./charts";

interface DashboardStats {
  purchases: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    totalAmount: number;
    thisMonthAmount: number;
    avgOrderValue: number;
    topSupplier: string;
    pendingOrders: number;
  };
  sales: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    totalAmount: number;
    thisMonthAmount: number;
    avgOrderValue: number;
    topCustomer: string;
    pendingOrders: number;
  };
  trends: {
    purchasesTrend: number;
    salesTrend: number;
    revenueTrend: number;
    profitMargin: number;
  };
}

export function PurchasesSalesDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchDashboardData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    try {
      // Fechas para comparación
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Consultas paralelas para purchases
      const [
        { data: allPurchases },
        { data: thisMonthPurchases },
        { data: lastMonthPurchases },
        { data: topSupplierData },
        { data: pendingPurchases }
      ] = await Promise.all([
        supabase.from("purchase_orders").select("total, currency"),
        supabase.from("purchase_orders").select("total, currency").gte("created_at", thisMonthStart.toISOString()),
        supabase.from("purchase_orders").select("total, currency").gte("created_at", lastMonthStart.toISOString()).lt("created_at", lastMonthEnd.toISOString()),
        supabase.from("purchase_orders").select("suppliers:supplier_id(name), total").not("supplier_id", "is", null),
        supabase.from("purchase_orders").select("id").eq("status", "OPEN")
      ]);

      // Consultas paralelas para sales
      const [
        { data: allSales },
        { data: thisMonthSales },
        { data: lastMonthSales },
        { data: topCustomerData },
        { data: pendingSales }
      ] = await Promise.all([
        supabase.from("sales_orders").select("total, currency"),
        supabase.from("sales_orders").select("total, currency").gte("created_at", thisMonthStart.toISOString()),
        supabase.from("sales_orders").select("total, currency").gte("created_at", lastMonthStart.toISOString()).lt("created_at", lastMonthEnd.toISOString()),
        supabase.from("sales_orders").select("customers:customer_id(name), total").not("customer_id", "is", null),
        supabase.from("sales_orders").select("id").eq("status", "OPEN")
      ]);

      // Calcular estadísticas de purchases
      const purchasesTotal = allPurchases?.length || 0;
      const purchasesThisMonth = thisMonthPurchases?.length || 0;
      const purchasesLastMonth = lastMonthPurchases?.length || 0;
      const purchasesTotalAmount = allPurchases?.reduce((sum, p) => sum + (Number(p.total) || 0), 0) || 0;
      const purchasesThisMonthAmount = thisMonthPurchases?.reduce((sum, p) => sum + (Number(p.total) || 0), 0) || 0;
      const purchasesAvgOrderValue = purchasesTotal > 0 ? purchasesTotalAmount / purchasesTotal : 0;

      // Top supplier
      const supplierTotals = topSupplierData?.reduce((acc: any, order: any) => {
        const supplierName = order.suppliers?.name || 'Sin proveedor';
        acc[supplierName] = (acc[supplierName] || 0) + (Number(order.total) || 0);
        return acc;
      }, {});
      const topSupplier = supplierTotals ? Object.keys(supplierTotals).reduce((a, b) => supplierTotals[a] > supplierTotals[b] ? a : b, '') : 'N/A';

      // Calcular estadísticas de sales
      const salesTotal = allSales?.length || 0;
      const salesThisMonth = thisMonthSales?.length || 0;
      const salesLastMonth = lastMonthSales?.length || 0;
      const salesTotalAmount = allSales?.reduce((sum, s) => sum + (Number(s.total) || 0), 0) || 0;
      const salesThisMonthAmount = thisMonthSales?.reduce((sum, s) => sum + (Number(s.total) || 0), 0) || 0;
      const salesAvgOrderValue = salesTotal > 0 ? salesTotalAmount / salesTotal : 0;

      // Top customer
      const customerTotals = topCustomerData?.reduce((acc: any, order: any) => {
        const customerName = order.customers?.name || 'Cliente general';
        acc[customerName] = (acc[customerName] || 0) + (Number(order.total) || 0);
        return acc;
      }, {});
      const topCustomer = customerTotals ? Object.keys(customerTotals).reduce((a, b) => customerTotals[a] > customerTotals[b] ? a : b, '') : 'N/A';

      // Calcular tendencias
      const purchasesTrend = purchasesLastMonth > 0 ? ((purchasesThisMonth - purchasesLastMonth) / purchasesLastMonth) * 100 : 0;
      const salesTrend = salesLastMonth > 0 ? ((salesThisMonth - salesLastMonth) / salesLastMonth) * 100 : 0;
      const revenueTrend = purchasesThisMonthAmount > 0 ? ((salesThisMonthAmount - purchasesThisMonthAmount) / purchasesThisMonthAmount) * 100 : 0;
      const profitMargin = salesThisMonthAmount > 0 ? ((salesThisMonthAmount - purchasesThisMonthAmount) / salesThisMonthAmount) * 100 : 0;

      setStats({
        purchases: {
          total: purchasesTotal,
          thisMonth: purchasesThisMonth,
          lastMonth: purchasesLastMonth,
          totalAmount: purchasesTotalAmount,
          thisMonthAmount: purchasesThisMonthAmount,
          avgOrderValue: purchasesAvgOrderValue,
          topSupplier,
          pendingOrders: pendingPurchases?.length || 0
        },
        sales: {
          total: salesTotal,
          thisMonth: salesThisMonth,
          lastMonth: salesLastMonth,
          totalAmount: salesTotalAmount,
          thisMonthAmount: salesThisMonthAmount,
          avgOrderValue: salesAvgOrderValue,
          topCustomer,
          pendingOrders: pendingSales?.length || 0
        },
        trends: {
          purchasesTrend,
          salesTrend,
          revenueTrend,
          profitMargin
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriod]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatTrend = (trend: number) => {
    const isPositive = trend >= 0;
    return (
      <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        <span className="text-sm font-medium">{Math.abs(trend).toFixed(1)}%</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Dashboard Compras & Ventas</h2>
          <RefreshCw className="h-5 w-5 animate-spin" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard Compras & Ventas</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border">
            {(['7d', '30d', '90d'] as const).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className="rounded-none first:rounded-l-lg last:rounded-r-lg"
              >
                {period === '7d' ? '7 días' : period === '30d' ? '30 días' : '90 días'}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Purchases KPIs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Compras</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.purchases.total}</div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Este mes: {stats.purchases.thisMonth}</p>
              {formatTrend(stats.trends.purchasesTrend)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Compras</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.purchases.thisMonthAmount)}</div>
            <p className="text-xs text-muted-foreground">
              Promedio: {formatCurrency(stats.purchases.avgOrderValue)}
            </p>
          </CardContent>
        </Card>

        {/* Sales KPIs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sales.total}</div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Este mes: {stats.sales.thisMonth}</p>
              {formatTrend(stats.trends.salesTrend)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.sales.thisMonthAmount)}</div>
            <p className="text-xs text-muted-foreground">
              Promedio: {formatCurrency(stats.sales.avgOrderValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Margen de Ganancia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.trends.profitMargin.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Ganancia: {formatCurrency(stats.sales.thisMonthAmount - stats.purchases.thisMonthAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-lg font-bold text-orange-600">{stats.purchases.pendingOrders}</div>
                <p className="text-xs text-muted-foreground">Compras</p>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-600">{stats.sales.pendingOrders}</div>
                <p className="text-xs text-muted-foreground">Ventas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Proveedor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium truncate">{stats.purchases.topSupplier}</div>
            <p className="text-xs text-muted-foreground">Mayor volumen de compras</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium truncate">{stats.sales.topCustomer}</div>
            <p className="text-xs text-muted-foreground">Mayor volumen de ventas</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Compras
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Órdenes este mes</span>
              <Badge variant="secondary">{stats.purchases.thisMonth}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Pendientes</span>
              <Badge variant="destructive">{stats.purchases.pendingOrders}</Badge>
            </div>
            <Button className="w-full" size="sm">
              <a href="/purchases" className="flex items-center gap-2">
                Ver todas las compras
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Ventas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Órdenes este mes</span>
              <Badge variant="secondary">{stats.sales.thisMonth}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Pendientes</span>
              <Badge variant="destructive">{stats.sales.pendingOrders}</Badge>
            </div>
            <Button className="w-full" size="sm">
              <a href="/sales" className="flex items-center gap-2">
                Ver todas las ventas
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="mt-8">
        <div className="mb-6">
          <h3 className="text-xl font-bold mb-2">Análisis y Tendencias</h3>
          <p className="text-muted-foreground">Visualiza el comportamiento de compras y ventas a lo largo del tiempo</p>
        </div>
        <PurchasesSalesCharts />
      </div>
    </div>
  );
}

"use client";
import { apiClient } from "@/lib/api/client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock data since the backend endpoint doesn't exist yet
    setStats({
      purchases: {
        total: 145,
        thisMonth: 32,
        lastMonth: 28,
        totalAmount: 245000,
        thisMonthAmount: 48500,
        avgOrderValue: 1515.60,
        topSupplier: "Distribuidora Hotelera S.A.",
        pendingOrders: 4
      },
      sales: {
        total: 856,
        thisMonth: 124,
        lastMonth: 115,
        totalAmount: 890500,
        thisMonthAmount: 145600,
        avgOrderValue: 1174.20,
        topCustomer: "Público General",
        pendingOrders: 12
      },
      trends: {
        purchasesTrend: 14.2,
        salesTrend: 7.8,
        revenueTrend: 9.5,
        profitMargin: 66.7
      }
    });
    setLoading(false);
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
            <Button className="w-full" size="sm" asChild>
              <Link href="/purchases" className="flex items-center gap-2">
                Ver todas las compras
                <ArrowUpRight className="h-4 w-4" />
              </Link>
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
            <Button className="w-full" size="sm" asChild>
              <Link href="/sales" className="flex items-center gap-2">
                Ver todas las ventas
                <ArrowUpRight className="h-4 w-4" />
              </Link>
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

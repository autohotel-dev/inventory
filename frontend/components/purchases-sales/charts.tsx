"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { 
  BarChart3, 
  TrendingUp, 
  Calendar,
  RefreshCw
} from "lucide-react";

interface ChartData {
  monthlyPurchases: Array<{ month: string; amount: number; count: number }>;
  monthlySales: Array<{ month: string; amount: number; count: number }>;
  topSuppliers: Array<{ name: string; total: number; orders: number }>;
  topCustomers: Array<{ name: string; total: number; orders: number }>;
  dailyTrends: Array<{ date: string; purchases: number; sales: number }>;
}

export function PurchasesSalesCharts() {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChart, setSelectedChart] = useState<'monthly' | 'daily' | 'suppliers' | 'customers'>('monthly');

  const fetchChartData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    try {
      // Obtener datos de los últimos 6 meses
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      // Obtener datos de los últimos 30 días para tendencias diarias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        { data: purchasesData },
        { data: salesData },
        { data: suppliersData },
        { data: customersData },
        { data: dailyPurchases },
        { data: dailySales }
      ] = await Promise.all([
        // Compras por mes
        supabase
          .from("purchase_orders")
          .select("created_at, total, currency")
          .gte("created_at", sixMonthsAgo.toISOString()),
        
        // Ventas por mes
        supabase
          .from("sales_orders")
          .select("created_at, total, currency")
          .gte("created_at", sixMonthsAgo.toISOString()),
        
        // Top proveedores
        supabase
          .from("purchase_orders")
          .select("total, suppliers!supplier_id(name)")
          .not("supplier_id", "is", null)
          .gte("created_at", sixMonthsAgo.toISOString()),
        
        // Top clientes
        supabase
          .from("sales_orders")
          .select("total, customers!customer_id(name)")
          .not("customer_id", "is", null)
          .gte("created_at", sixMonthsAgo.toISOString()),
        
        // Compras diarias (últimos 30 días)
        supabase
          .from("purchase_orders")
          .select("created_at, total")
          .gte("created_at", thirtyDaysAgo.toISOString()),
        
        // Ventas diarias (últimos 30 días)
        supabase
          .from("sales_orders")
          .select("created_at, total")
          .gte("created_at", thirtyDaysAgo.toISOString())
      ]);

      // Procesar datos mensuales de compras
      const monthlyPurchases = processMonthlyData(purchasesData || []);
      const monthlySales = processMonthlyData(salesData || []);
      
      // Procesar top proveedores
      const topSuppliers = processTopSuppliers(suppliersData || []);
      
      // Procesar top clientes
      const topCustomers = processTopCustomers(customersData || []);
      
      // Procesar tendencias diarias
      const dailyTrends = processDailyTrends(dailyPurchases || [], dailySales || []);

      setChartData({
        monthlyPurchases,
        monthlySales,
        topSuppliers,
        topCustomers,
        dailyTrends
      });
      
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processMonthlyData = (data: any[]) => {
    const monthlyData: { [key: string]: { amount: number; count: number } } = {};
    
    data.forEach(item => {
      const date = new Date(item.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { amount: 0, count: 0 };
      }
      
      monthlyData[monthKey].amount += Number(item.total) || 0;
      monthlyData[monthKey].count += 1;
    });
    
    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }),
        amount: data.amount,
        count: data.count
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  };

  const processTopSuppliers = (data: any[]) => {
    const supplierTotals: { [key: string]: { total: number; orders: number } } = {};
    
    data.forEach(item => {
      if (item.suppliers && item.suppliers.length > 0) {
        const supplierName = item.suppliers[0].name;
        if (!supplierTotals[supplierName]) {
          supplierTotals[supplierName] = { total: 0, orders: 0 };
        }
        supplierTotals[supplierName].total += Number(item.total) || 0;
        supplierTotals[supplierName].orders += 1;
      }
    });
    
    return Object.entries(supplierTotals)
      .map(([name, data]) => ({ name, total: data.total, orders: data.orders }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  };

  const processTopCustomers = (data: any[]) => {
    const customerTotals: { [key: string]: { total: number; orders: number } } = {};
    
    data.forEach(item => {
      if (item.customers && item.customers.length > 0) {
        const customerName = item.customers[0].name;
        if (!customerTotals[customerName]) {
          customerTotals[customerName] = { total: 0, orders: 0 };
        }
        customerTotals[customerName].total += Number(item.total) || 0;
        customerTotals[customerName].orders += 1;
      }
    });
    
    return Object.entries(customerTotals)
      .map(([name, data]) => ({ name, total: data.total, orders: data.orders }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  };

  const processDailyTrends = (purchasesData: any[], salesData: any[]) => {
    const dailyData: { [key: string]: { purchases: number; sales: number } } = {};
    
    // Procesar compras
    purchasesData.forEach(item => {
      const dateKey = new Date(item.created_at).toISOString().split('T')[0];
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { purchases: 0, sales: 0 };
      }
      dailyData[dateKey].purchases += Number(item.total) || 0;
    });
    
    // Procesar ventas
    salesData.forEach(item => {
      const dateKey = new Date(item.created_at).toISOString().split('T')[0];
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { purchases: 0, sales: 0 };
      }
      dailyData[dateKey].sales += Number(item.total) || 0;
    });
    
    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
        purchases: data.purchases,
        sales: data.sales
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14); // Últimos 14 días
  };

  useEffect(() => {
    fetchChartData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const renderSimpleBarChart = (data: any[], dataKey: string, label: string, color: string) => {
    if (!data.length) return <div className="text-center text-muted-foreground py-8">No hay datos disponibles</div>;
    
    const maxValue = Math.max(...data.map(item => item[dataKey]));
    
    return (
      <div className="space-y-4">
        <div className="grid gap-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-20 text-xs text-muted-foreground truncate">
                {item.month || item.name || item.date}
              </div>
              <div className="flex-1 relative">
                <div className="h-6 bg-muted rounded-sm overflow-hidden">
                  <div 
                    className={`h-full ${color} transition-all duration-500`}
                    style={{ width: `${(item[dataKey] / maxValue) * 100}%` }}
                  />
                </div>
                <div className="absolute right-2 top-0 h-6 flex items-center">
                  <span className="text-xs font-medium">
                    {dataKey === 'amount' || dataKey === 'total' ? formatCurrency(item[dataKey]) : item[dataKey]}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDualBarChart = (data: any[]) => {
    if (!data.length) return <div className="text-center text-muted-foreground py-8">No hay datos disponibles</div>;
    
    const maxValue = Math.max(...data.map(item => Math.max(item.purchases, item.sales)));
    
    return (
      <div className="space-y-4">
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-sm"></div>
            <span>Compras</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
            <span>Ventas</span>
          </div>
        </div>
        <div className="grid gap-3">
          {data.map((item, index) => (
            <div key={index} className="space-y-1">
              <div className="text-xs text-muted-foreground">{item.date}</div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <div className="h-4 bg-muted rounded-sm overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 transition-all duration-500"
                      style={{ width: `${(item.purchases / maxValue) * 100}%` }}
                    />
                  </div>
                  <div className="absolute right-1 top-0 h-4 flex items-center">
                    <span className="text-xs">{formatCurrency(item.purchases)}</span>
                  </div>
                </div>
                <div className="flex-1 relative">
                  <div className="h-4 bg-muted rounded-sm overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${(item.sales / maxValue) * 100}%` }}
                    />
                  </div>
                  <div className="absolute right-1 top-0 h-4 flex items-center">
                    <span className="text-xs">{formatCurrency(item.sales)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="h-6 bg-gray-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!chartData) return null;

  return (
    <div className="space-y-6">
      {/* Chart Selection */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedChart === 'monthly' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedChart('monthly')}
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Mensual
        </Button>
        <Button
          variant={selectedChart === 'daily' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedChart('daily')}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Tendencias
        </Button>
        <Button
          variant={selectedChart === 'suppliers' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedChart('suppliers')}
        >
          Top Proveedores
        </Button>
        <Button
          variant={selectedChart === 'customers' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedChart('customers')}
        >
          Top Clientes
        </Button>
        <Button variant="outline" size="sm" onClick={fetchChartData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {selectedChart === 'monthly' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-orange-600" />
                  Compras Mensuales
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderSimpleBarChart(chartData.monthlyPurchases, 'amount', 'Monto', 'bg-orange-500')}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  Ventas Mensuales
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderSimpleBarChart(chartData.monthlySales, 'amount', 'Monto', 'bg-green-500')}
              </CardContent>
            </Card>
          </>
        )}

        {selectedChart === 'daily' && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Tendencias Diarias (Últimos 14 días)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderDualBarChart(chartData.dailyTrends)}
            </CardContent>
          </Card>
        )}

        {selectedChart === 'suppliers' && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                Top 5 Proveedores (Últimos 6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderSimpleBarChart(chartData.topSuppliers, 'total', 'Total', 'bg-purple-500')}
            </CardContent>
          </Card>
        )}

        {selectedChart === 'customers' && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Top 5 Clientes (Últimos 6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderSimpleBarChart(chartData.topCustomers, 'total', 'Total', 'bg-blue-500')}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

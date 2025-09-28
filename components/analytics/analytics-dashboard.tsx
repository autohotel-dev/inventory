"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  DollarSign, 
  AlertTriangle,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  RefreshCw
} from "lucide-react";

interface AnalyticsData {
  // Resumen general
  totalProducts: number;
  totalValue: number;
  lowStockProducts: number;
  criticalStockProducts: number;
  
  // Movimientos
  totalMovements: number;
  movementsToday: number;
  movementsThisWeek: number;
  movementsThisMonth: number;
  
  // Por categoría
  categoriesData: Array<{
    name: string;
    productCount: number;
    totalValue: number;
    avgPrice: number;
  }>;
  
  // Por almacén
  warehousesData: Array<{
    name: string;
    code: string;
    productCount: number;
    totalStock: number;
    totalValue: number;
    utilizationRate: number;
  }>;
  
  // Productos top
  topProducts: Array<{
    name: string;
    sku: string;
    totalStock: number;
    totalValue: number;
    movementCount: number;
  }>;
  
  // Movimientos recientes
  recentMovements: Array<{
    id: string;
    product_name: string;
    warehouse_name: string;
    movement_type: string;
    quantity: number;
    reason: string;
    created_at: string;
  }>;
  
  // Tendencias (últimos 7 días)
  movementTrends: Array<{
    date: string;
    in_movements: number;
    out_movements: number;
    adjustments: number;
  }>;
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');

  const fetchAnalytics = async () => {
    const supabase = createClient();
    setLoading(true);
    
    try {
      // Obtener productos con stock y categorías
      const { data: productsData } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(name),
          stock:stock(qty, warehouse:warehouses(name, code))
        `);

      // Obtener movimientos con detalles
      const { data: movementsData } = await supabase
        .from("inventory_movements")
        .select(`
          *,
          product:products(name, sku),
          warehouse:warehouses(name, code)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      // Obtener almacenes con stock
      const { data: warehousesData } = await supabase
        .from("warehouses")
        .select(`
          *,
          stock:stock(qty, product:products(price))
        `);

      // Procesar datos
      const analytics = processAnalyticsData(productsData || [], movementsData || [], warehousesData || []);
      setData(analytics);
      
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = (products: any[], movements: any[], warehouses: any[]): AnalyticsData => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calcular stock total por producto
    const productsWithStock = products.map(product => {
      const totalStock = product.stock?.reduce((sum: number, s: any) => sum + (s.qty || 0), 0) || 0;
      const totalValue = totalStock * product.price;
      const stockStatus = totalStock === 0 ? 'critical' : 
                         totalStock <= product.min_stock ? 'low' : 'normal';
      
      return {
        ...product,
        totalStock,
        totalValue,
        stockStatus
      };
    });

    // Resumen general
    const totalProducts = productsWithStock.length;
    const totalValue = productsWithStock.reduce((sum, p) => sum + p.totalValue, 0);
    const lowStockProducts = productsWithStock.filter(p => p.stockStatus === 'low').length;
    const criticalStockProducts = productsWithStock.filter(p => p.stockStatus === 'critical').length;

    // Movimientos por período
    const totalMovements = movements.length;
    const movementsToday = movements.filter(m => 
      new Date(m.created_at) >= today
    ).length;
    const movementsThisWeek = movements.filter(m => 
      new Date(m.created_at) >= weekAgo
    ).length;
    const movementsThisMonth = movements.filter(m => 
      new Date(m.created_at) >= monthAgo
    ).length;

    // Datos por categoría
    const categoryMap = new Map();
    productsWithStock.forEach(product => {
      const categoryName = product.category?.name || 'Sin categoría';
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          name: categoryName,
          productCount: 0,
          totalValue: 0,
          totalPrice: 0
        });
      }
      const cat = categoryMap.get(categoryName);
      cat.productCount++;
      cat.totalValue += product.totalValue;
      cat.totalPrice += product.price;
    });

    const categoriesData = Array.from(categoryMap.values()).map(cat => ({
      ...cat,
      avgPrice: cat.totalPrice / cat.productCount
    }));

    // Datos por almacén
    const warehousesData = warehouses.map(warehouse => {
      const warehouseStock = warehouse.stock || [];
      const productCount = warehouseStock.length;
      const totalStock = warehouseStock.reduce((sum: number, s: any) => sum + (s.qty || 0), 0);
      const totalValue = warehouseStock.reduce((sum: number, s: any) => 
        sum + ((s.qty || 0) * (s.product?.price || 0)), 0
      );
      const utilizationRate = Math.min((productCount / 100) * 100, 100);

      return {
        name: warehouse.name,
        code: warehouse.code,
        productCount,
        totalStock,
        totalValue,
        utilizationRate
      };
    });

    // Top productos (por valor de inventario)
    const topProducts = productsWithStock
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10)
      .map(product => {
        const movementCount = movements.filter(m => m.product_id === product.id).length;
        return {
          name: product.name,
          sku: product.sku,
          totalStock: product.totalStock,
          totalValue: product.totalValue,
          movementCount
        };
      });

    // Movimientos recientes
    const recentMovements = movements.slice(0, 10).map(movement => ({
      id: movement.id,
      product_name: movement.product?.name || 'Producto eliminado',
      warehouse_name: movement.warehouse?.name || 'Almacén eliminado',
      movement_type: movement.movement_type,
      quantity: movement.quantity,
      reason: movement.reason,
      created_at: movement.created_at
    }));

    // Tendencias de movimientos (últimos 7 días)
    const movementTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayMovements = movements.filter(m => 
        m.created_at.startsWith(dateStr)
      );
      
      movementTrends.push({
        date: dateStr,
        in_movements: dayMovements.filter(m => m.movement_type === 'IN').length,
        out_movements: dayMovements.filter(m => m.movement_type === 'OUT').length,
        adjustments: dayMovements.filter(m => m.movement_type === 'ADJUSTMENT').length
      });
    }

    return {
      totalProducts,
      totalValue,
      lowStockProducts,
      criticalStockProducts,
      totalMovements,
      movementsToday,
      movementsThisWeek,
      movementsThisMonth,
      categoriesData,
      warehousesData,
      topProducts,
      recentMovements,
      movementTrends
    };
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <div className="text-lg font-medium text-muted-foreground">
          No se pudieron cargar los datos de analytics
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Dashboard Ejecutivo</h2>
          <p className="text-muted-foreground">
            Análisis completo de tu inventario y operaciones
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={selectedPeriod === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod('week')}
          >
            Semana
          </Button>
          <Button
            variant={selectedPeriod === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod('month')}
          >
            Mes
          </Button>
          <Button
            variant={selectedPeriod === 'quarter' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod('quarter')}
          >
            Trimestre
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Totales</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              {data.lowStockProducts + data.criticalStockProducts} con stock bajo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${data.totalValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Valor total del inventario
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movimientos Hoy</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.movementsToday}</div>
            <p className="text-xs text-muted-foreground">
              {data.movementsThisWeek} esta semana
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data.criticalStockProducts}
            </div>
            <p className="text-xs text-muted-foreground">
              Productos sin stock
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos y tablas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productos por categoría */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Productos por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.categoriesData.map((category, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ 
                        backgroundColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)` 
                      }}
                    />
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{category.productCount}</div>
                    <div className="text-xs text-muted-foreground">
                      ${category.totalValue.toFixed(0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Almacenes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Rendimiento por Almacén
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.warehousesData.map((warehouse, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{warehouse.name}</span>
                    <Badge variant="outline">{warehouse.code}</Badge>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{warehouse.productCount} productos</span>
                    <span>${warehouse.totalValue.toFixed(0)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${warehouse.utilizationRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top productos y movimientos recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top productos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Productos por Valor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topProducts.slice(0, 5).map((product, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      SKU: {product.sku} • {product.movementCount} movimientos
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">${product.totalValue.toFixed(0)}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.totalStock} unidades
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Movimientos recientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Movimientos Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentMovements.slice(0, 5).map((movement) => (
                <div key={movement.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{movement.product_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {movement.warehouse_name} • {movement.reason}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant={
                        movement.movement_type === 'IN' ? 'default' :
                        movement.movement_type === 'OUT' ? 'destructive' : 'secondary'
                      }
                    >
                      {movement.movement_type === 'IN' && '📈'}
                      {movement.movement_type === 'OUT' && '📉'}
                      {movement.movement_type === 'ADJUSTMENT' && '🔄'}
                      {movement.quantity}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {new Date(movement.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tendencias de movimientos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Tendencias de Movimientos (Últimos 7 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.movementTrends.map((trend, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="font-medium">
                  {new Date(trend.date).toLocaleDateString('es-ES', { 
                    weekday: 'short', 
                    day: 'numeric', 
                    month: 'short' 
                  })}
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600">
                    📈 {trend.in_movements}
                  </span>
                  <span className="text-red-600">
                    📉 {trend.out_movements}
                  </span>
                  <span className="text-orange-600">
                    🔄 {trend.adjustments}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

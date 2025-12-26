"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Package,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Warehouse,
  BarChart3,
  RefreshCw,
  Filter,
  Eye,
  X
} from "lucide-react";

interface StockItem {
  product_id: string;
  sku: string;
  name: string;
  category_name?: string;
  unit: string;
  price: number;
  cost: number;
  min_stock: number;
  total_stock: number;
  stock_by_warehouse: Array<{
    warehouse_id: string;
    warehouse_name: string;
    warehouse_code: string;
    qty: number;
  }>;
  stock_status: 'critical' | 'low' | 'normal' | 'high';
  stock_value: number;
  last_movement?: string;
}

export function AdvancedStockView() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const { success, error: showError } = useToast();

  const fetchStock = async () => {
    const supabase = createClient();
    setLoading(true);

    try {
      // Obtener productos con stock
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          id,
          sku,
          name,
          unit,
          price,
          cost,
          min_stock,
          is_active,
          category:categories(name),
          stock:stock(
            qty,
            warehouse:warehouses(id, name, code)
          )
        `)
        .eq("is_active", true);

      if (productsError) throw productsError;

      // Obtener almacenes para filtros
      const { data: warehousesData, error: warehousesError } = await supabase
        .from("warehouses")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");

      if (!warehousesError && warehousesData) {
        setWarehouses(warehousesData);
      }

      // Obtener último movimiento por producto
      const { data: lastMovements, error: movementsError } = await supabase
        .from("inventory_movements")
        .select("product_id, created_at")
        .order("created_at", { ascending: false });

      const lastMovementMap = new Map();
      if (!movementsError && lastMovements) {
        lastMovements.forEach(movement => {
          if (!lastMovementMap.has(movement.product_id)) {
            lastMovementMap.set(movement.product_id, movement.created_at);
          }
        });
      }

      // Procesar datos de stock
      const processedStock: StockItem[] = (productsData || []).map((product: any) => {
        const stockByWarehouse = (product.stock || []).map((s: any) => ({
          warehouse_id: s.warehouse?.id || '',
          warehouse_name: s.warehouse?.name || 'Sin nombre',
          warehouse_code: s.warehouse?.code || 'N/A',
          qty: s.qty || 0
        }));

        const totalStock = stockByWarehouse.reduce((sum: number, s: any) => sum + s.qty, 0);
        const stockValue = totalStock * product.price;

        let stockStatus: 'critical' | 'low' | 'normal' | 'high' = 'normal';
        if (totalStock === 0) {
          stockStatus = 'critical';
        } else if (totalStock <= product.min_stock) {
          stockStatus = 'low';
        } else if (totalStock > product.min_stock * 3) {
          stockStatus = 'high';
        }

        return {
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          category_name: (product.category as any)?.name,
          unit: product.unit,
          price: product.price,
          cost: product.cost,
          min_stock: product.min_stock,
          total_stock: totalStock,
          stock_by_warehouse: stockByWarehouse,
          stock_status: stockStatus,
          stock_value: stockValue,
          last_movement: lastMovementMap.get(product.id)
        };
      });

      setStockItems(processedStock);
    } catch (error) {
      console.error("Error fetching stock:", error);
      showError("Error", "No se pudo cargar el stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  const filteredItems = stockItems.filter(item => {
    const matchesSearch = search === "" ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      (item.category_name && item.category_name.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "" || item.stock_status === statusFilter;

    const matchesWarehouse = warehouseFilter === "" ||
      (warehouseFilter === "UNASSIGNED"
        ? item.stock_by_warehouse.length === 0 || item.stock_by_warehouse.every(s => s.qty === 0)
        : item.stock_by_warehouse.some(s => s.warehouse_id === warehouseFilter && s.qty > 0));

    return matchesSearch && matchesStatus && matchesWarehouse;
  });

  const handleViewDetail = (item: StockItem) => {
    setSelectedItem(item);
    setShowDetail(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Estadísticas
  const totalProducts = stockItems.length;
  const criticalStock = stockItems.filter(item => item.stock_status === 'critical').length;
  const lowStock = stockItems.filter(item => item.stock_status === 'low').length;
  const totalValue = stockItems.reduce((sum, item) => sum + item.stock_value, 0);

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              Con stock registrado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Crítico</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalStock}</div>
            <p className="text-xs text-muted-foreground">
              Sin stock disponible
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowStock}</div>
            <p className="text-xs text-muted-foreground">
              Por debajo del mínimo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Valor del inventario
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controles y filtros */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar productos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={fetchStock} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
          <div>
            <label className="block text-sm font-medium mb-2">Estado de Stock</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="">Todos los estados</option>
              <option value="critical">🔴 Crítico (Sin stock)</option>
              <option value="low">🟡 Bajo (Mínimo)</option>
              <option value="normal">🟢 Normal</option>
              <option value="high">🔵 Alto</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Almacén</label>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="">Todos los almacenes</option>
              <option value="UNASSIGNED">📦 Sin ubicación asignada</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setWarehouseFilter("");
              }}
              className="w-full"
            >
              <Filter className="h-4 w-4 mr-2" />
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </div>

      {/* Tabla de stock */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Producto</th>
              <th className="text-center p-4 font-medium">Stock Actual</th>
              <th className="text-center p-4 font-medium">Estado</th>
              <th className="text-right p-4 font-medium">Valor</th>
              <th className="text-center p-4 font-medium">Almacenes</th>
              <th className="text-center p-4 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.product_id} className="border-t hover:bg-muted/25 transition-colors">
                <td className="p-4">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      SKU: {item.sku}
                      {item.category_name && ` • ${item.category_name}`}
                    </div>
                  </div>
                </td>

                <td className="p-4 text-center">
                  <div className="font-medium text-lg">
                    {item.total_stock} {item.unit}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Mín: {item.min_stock} {item.unit}
                  </div>
                </td>

                <td className="p-4 text-center">
                  <Badge
                    variant={
                      item.stock_status === 'critical' ? 'destructive' :
                        item.stock_status === 'low' ? 'secondary' :
                          item.stock_status === 'high' ? 'default' : 'outline'
                    }
                  >
                    {item.stock_status === 'critical' && '🔴 Crítico'}
                    {item.stock_status === 'low' && '🟡 Bajo'}
                    {item.stock_status === 'normal' && '🟢 Normal'}
                    {item.stock_status === 'high' && '🔵 Alto'}
                  </Badge>
                </td>

                <td className="p-4 text-right">
                  <div className="font-medium">${item.stock_value.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">
                    ${item.price.toFixed(2)} c/u
                  </div>
                </td>

                <td className="p-4 text-center">
                  <div className="text-sm">
                    {item.stock_by_warehouse.filter(s => s.qty > 0).length} ubicaciones
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.stock_by_warehouse.filter(s => s.qty > 0).map(s => s.warehouse_code).join(', ')}
                  </div>
                </td>

                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetail(item)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver Detalle
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-lg font-medium text-muted-foreground mb-2">
              No se encontraron productos
            </div>
            <div className="text-sm text-muted-foreground">
              Intenta ajustar los filtros de búsqueda
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <div>
          Mostrando {filteredItems.length} de {stockItems.length} productos
        </div>
        <div>
          Última actualización: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Modal de detalle */}
      {showDetail && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                Detalle de Stock - {selectedItem.name}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetail(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <StockDetailView item={selectedItem} />
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para mostrar detalle de stock
function StockDetailView({ item }: { item: StockItem }) {
  return (
    <div className="space-y-6">
      {/* Información general */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Stock Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {item.total_stock} {item.unit}
            </div>
            <div className="text-sm text-muted-foreground">
              Mínimo: {item.min_stock} {item.unit}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${item.stock_value.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              ${item.price.toFixed(2)} por {item.unit}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                item.stock_status === 'critical' ? 'destructive' :
                  item.stock_status === 'low' ? 'secondary' :
                    item.stock_status === 'high' ? 'default' : 'outline'
              }
              className="text-lg px-3 py-1"
            >
              {item.stock_status === 'critical' && '🔴 Crítico'}
              {item.stock_status === 'low' && '🟡 Bajo'}
              {item.stock_status === 'normal' && '🟢 Normal'}
              {item.stock_status === 'high' && '🔵 Alto'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Stock por almacén */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Stock por Almacén
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {item.stock_by_warehouse.map((warehouse, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{warehouse.warehouse_name}</div>
                  <div className="text-sm text-muted-foreground">
                    Código: {warehouse.warehouse_code}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">
                    {warehouse.qty} {item.unit}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ${(warehouse.qty * item.price).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}

            {item.stock_by_warehouse.filter(s => s.qty > 0).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay stock en ningún almacén
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

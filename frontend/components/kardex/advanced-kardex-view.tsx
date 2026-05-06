"use client";

import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Package,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Calendar,
  RefreshCw,
  Filter,
  Download,
  BarChart3,
  ArrowDownCircle,
  X
} from "lucide-react";

interface KardexEntry {
  id: string;
  created_at: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  notes?: string;
  warehouse_name: string;
  warehouse_code: string;
  balance: number;
  product_name: string;
  product_sku: string;
}

interface ProductSummary {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  unit: string;
  total_movements: number;
  last_movement: string;
}

export function AdvancedKardexView() {
  const [kardexEntries, setKardexEntries] = useState<KardexEntry[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const { success, error: showError } = useToast();

  const fetchProducts = async () => {
    try {
      const { apiClient } = await import("@/lib/api/client");
      
      const [
        { data: productsData },
        { data: stockData },
        { data: movementsData }
      ] = await Promise.all([
        apiClient.get("/system/crud/products") as any,
        apiClient.get("/system/crud/stock") as any,
        apiClient.get("/system/crud/inventory_movements") as any
      ]);

      const lastMovementMap = new Map();
      const movementCountMap = new Map();

      if (movementsData) {
        movementsData.forEach((movement: any) => {
          if (!lastMovementMap.has(movement.product_id) || new Date(movement.created_at) > new Date(lastMovementMap.get(movement.product_id))) {
            lastMovementMap.set(movement.product_id, movement.created_at);
          }
          movementCountMap.set(
            movement.product_id,
            (movementCountMap.get(movement.product_id) || 0) + 1
          );
        });
      }

      const productsSummary: ProductSummary[] = (productsData || []).map((product: any) => {
        // Calculate stock
        const productStock = (stockData || [])
          .filter((s: any) => s.product_id === product.id)
          .reduce((sum: number, s: any) => sum + (s.qty || 0), 0);

        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          current_stock: productStock,
          unit: product.unit,
          total_movements: movementCountMap.get(product.id) || 0,
          last_movement: lastMovementMap.get(product.id) || ''
        };
      });

      setProducts(productsSummary);
    } catch (error) {
      console.error("Error fetching products:", error);
      showError("Error", "No se pudieron cargar los productos");
    }
  };

  const fetchKardex = async (productId: string) => {
    if (!productId) return;
    setLoading(true);

    try {
      const { apiClient } = await import("@/lib/api/client");
      
      const [
        { data: movementsData },
        { data: productData },
        { data: warehousesData },
        { data: reasonsData }
      ] = await Promise.all([
        apiClient.get(`/system/crud/inventory_movements?product_id=${productId}`) as any,
        apiClient.get(`/system/crud/products/${productId}`) as any,
        apiClient.get("/system/crud/warehouses") as any,
        apiClient.get("/system/crud/movement_reasons") as any
      ]);

      const warehousesMap = new Map((warehousesData || []).map((w: any) => [w.id, w]));
      const reasonsMap = new Map((reasonsData || []).map((r: any) => [r.id, r]));

      // Sort movements by date
      const sortedMovements = (movementsData || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Calcular balance acumulado
      let runningBalance = 0;
      const kardexData: KardexEntry[] = sortedMovements.map((movement: any) => {
        if (movement.movement_type === 'IN') {
          runningBalance += movement.quantity;
        } else if (movement.movement_type === 'OUT') {
          runningBalance -= movement.quantity;
        } else { // ADJUSTMENT
          runningBalance = movement.quantity;
        }

        const warehouse = warehousesMap.get(movement.warehouse_id);
        const reason = reasonsMap.get(movement.reason_id);

        return {
          id: movement.id,
          created_at: movement.created_at,
          movement_type: movement.movement_type,
          quantity: movement.quantity,
          reason: reason?.name || movement.reason || 'N/A',
          notes: movement.notes,
          warehouse_name: warehouse?.name || 'Almacén eliminado',
          warehouse_code: warehouse?.code || 'N/A',
          balance: runningBalance,
          product_name: productData?.name || 'Producto eliminado',
          product_sku: productData?.sku || 'N/A'
        };
      });

      setKardexEntries(kardexData);
    } catch (error) {
      console.error("Error fetching kardex:", error);
      showError("Error", "No se pudo cargar el kardex");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchKardex(selectedProduct);
    }
  }, [selectedProduct]);

  const filteredEntries = kardexEntries.filter(entry => {
    const matchesSearch = search === "" ||
      entry.reason.toLowerCase().includes(search.toLowerCase()) ||
      entry.warehouse_name.toLowerCase().includes(search.toLowerCase()) ||
      (entry.notes && entry.notes.toLowerCase().includes(search.toLowerCase()));

    const matchesDate = dateFilter === "" ||
      new Date(entry.created_at).toDateString() === new Date(dateFilter).toDateString();

    const matchesType = typeFilter === "" || entry.movement_type === typeFilter;

    return matchesSearch && matchesDate && matchesType;
  });

  const selectedProductInfo = products.find(p => p.id === selectedProduct);

  // Estadísticas del kardex
  const totalMovements = kardexEntries.length;
  const inMovements = kardexEntries.filter(e => e.movement_type === 'IN').length;
  const outMovements = kardexEntries.filter(e => e.movement_type === 'OUT').length;
  const adjustments = kardexEntries.filter(e => e.movement_type === 'ADJUSTMENT').length;

  return (
    <div className="space-y-6">
      {/* Selector de producto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Seleccionar Producto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Producto</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">Seleccionar producto...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku}) - Stock: {product.current_stock} {product.unit}
                  </option>
                ))}
              </select>
            </div>

            {selectedProductInfo && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Información del Producto:</div>
                <div className="text-sm text-muted-foreground">
                  <div>SKU: {selectedProductInfo.sku}</div>
                  <div>Stock Actual: {selectedProductInfo.current_stock} {selectedProductInfo.unit}</div>
                  <div>Total Movimientos: {selectedProductInfo.total_movements}</div>
                  {selectedProductInfo.last_movement && (
                    <div>Último Movimiento: {new Date(selectedProductInfo.last_movement).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedProduct && (
        <>
          {/* Estadísticas del kardex */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Movimientos</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalMovements}</div>
                <p className="text-xs text-muted-foreground">
                  Historial completo
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Entradas</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{inMovements}</div>
                <p className="text-xs text-muted-foreground">
                  Incrementos de stock
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Salidas</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{outMovements}</div>
                <p className="text-xs text-muted-foreground">
                  Decrementos de stock
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ajustes</CardTitle>
                <RotateCcw className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{adjustments}</div>
                <p className="text-xs text-muted-foreground">
                  Correcciones
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
                  placeholder="Buscar en kardex..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => fetchKardex(selectedProduct)} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
              </div>
            </div>

            {/* Filtros con diseño premium */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Tipo de Movimiento */}
              <div className={`relative p-4 rounded-xl border transition-all duration-300 ${typeFilter ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-muted/30 border-border/50 hover:border-blue-500/30 hover:bg-blue-500/5'}`}>
                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                  <div className={`p-1.5 rounded-lg ${typeFilter ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500'}`}>
                    <Package className="h-3.5 w-3.5" />
                  </div>
                  <span className={typeFilter ? 'text-blue-400' : 'text-muted-foreground'}>Tipo</span>
                </label>
                <div className="relative group">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-blue-500/30 focus:outline-none hover:bg-background shadow-sm"
                  >
                    <option value="">✨ Todos</option>
                    <option value="IN">📈 Entradas</option>
                    <option value="OUT">📉 Salidas</option>
                    <option value="ADJUSTMENT">🔄 Ajustes</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:translate-y-[-45%]">
                    <div className={`p-1 rounded-md ${typeFilter ? 'bg-blue-500/20' : 'bg-muted'}`}>
                      <ArrowDownCircle className={`h-4 w-4 ${typeFilter ? 'text-blue-500' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Fecha */}
              <div className={`relative p-4 rounded-xl border transition-all duration-300 ${dateFilter ? 'bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/30 shadow-lg shadow-purple-500/5' : 'bg-muted/30 border-border/50 hover:border-purple-500/30 hover:bg-purple-500/5'}`}>
                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                  <div className={`p-1.5 rounded-lg ${dateFilter ? 'bg-purple-500 text-white' : 'bg-purple-500/10 text-purple-500'}`}>
                    <Calendar className="h-3.5 w-3.5" />
                  </div>
                  <span className={dateFilter ? 'text-purple-400' : 'text-muted-foreground'}>Fecha</span>
                </label>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="border-0 bg-background/90 backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-purple-500/30"
                />
              </div>

              {/* Limpiar Filtros */}
              <div className="flex items-end">
                {(typeFilter || dateFilter || search) ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch("");
                      setDateFilter("");
                      setTypeFilter("");
                    }}
                    className="w-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 gap-2 transition-colors"
                  >
                    <X className="h-4 w-4" />
                    Limpiar
                  </Button>
                ) : (
                  <div className="w-full p-4 rounded-xl border border-dashed border-border/50 bg-muted/10 flex items-center justify-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Sin filtros
                    </span>
                  </div>
                )}
              </div>

              {/* Exportar */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    const csvContent = [
                      ['Fecha', 'Tipo', 'Cantidad', 'Razón', 'Almacén', 'Balance', 'Notas'].join(','),
                      ...filteredEntries.map((entry: any) => [
                        new Date(entry.created_at).toLocaleDateString(),
                        entry.movement_type,
                        entry.quantity,
                        entry.reason,
                        entry.warehouse_name,
                        entry.balance,
                        entry.notes || ''
                      ].join(','))
                    ].join('\n');

                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `kardex_${selectedProductInfo?.sku}_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                  }}
                  className="w-full gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
              </div>
            </div>
          </div>

          {/* Tabla de kardex */}
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium">Fecha/Hora</th>
                  <th className="text-center p-4 font-medium">Tipo</th>
                  <th className="text-right p-4 font-medium">Cantidad</th>
                  <th className="text-right p-4 font-medium">Balance</th>
                  <th className="text-left p-4 font-medium">Almacén</th>
                  <th className="text-left p-4 font-medium">Razón</th>
                  <th className="text-left p-4 font-medium">Notas</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="border-t hover:bg-muted/25 transition-colors">
                      <td className="p-4">
                        <div className="text-sm">
                          <div className="font-medium">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-muted-foreground">
                            {new Date(entry.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <Badge
                          variant={
                            entry.movement_type === 'IN' ? 'default' :
                              entry.movement_type === 'OUT' ? 'destructive' : 'secondary'
                          }
                        >
                          {entry.movement_type === 'IN' && '📈 Entrada'}
                          {entry.movement_type === 'OUT' && '📉 Salida'}
                          {entry.movement_type === 'ADJUSTMENT' && '🔄 Ajuste'}
                        </Badge>
                      </td>

                      <td className="p-4 text-right">
                        <div className={`font-medium ${entry.movement_type === 'IN' ? 'text-green-600' :
                          entry.movement_type === 'OUT' ? 'text-red-600' : 'text-orange-600'
                          }`}>
                          {entry.movement_type === 'OUT' ? '-' : '+'}
                          {entry.quantity}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {selectedProductInfo?.unit}
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <div className="font-bold text-lg">
                          {entry.balance}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          balance
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-medium">{entry.warehouse_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {entry.warehouse_code}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-medium">{entry.reason}</div>
                      </td>

                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">
                          {entry.notes || '-'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {!loading && filteredEntries.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <div className="text-lg font-medium text-muted-foreground mb-2">
                  {kardexEntries.length === 0
                    ? "No hay movimientos registrados"
                    : "No se encontraron movimientos"
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  {kardexEntries.length === 0
                    ? "Los movimientos aparecerán aquí cuando se registren cambios de stock"
                    : "Intenta ajustar los filtros de búsqueda"
                  }
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && (
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <div>
                Mostrando {filteredEntries.length} de {kardexEntries.length} movimientos
              </div>
              <div>
                Balance actual: {selectedProductInfo?.current_stock} {selectedProductInfo?.unit}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

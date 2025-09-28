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
  TrendingUp, 
  TrendingDown,
  RotateCcw,
  Calendar,
  RefreshCw,
  Filter,
  Download,
  BarChart3
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
    const supabase = createClient();
    try {
      // Obtener productos con resumen de movimientos
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          id,
          name,
          sku,
          unit,
          stock:stock(qty)
        `)
        .eq("is_active", true);

      if (productsError) throw productsError;

      // Obtener último movimiento por producto
      const { data: movementsData, error: movementsError } = await supabase
        .from("inventory_movements")
        .select("product_id, created_at")
        .order("created_at", { ascending: false });

      const lastMovementMap = new Map();
      const movementCountMap = new Map();

      if (!movementsError && movementsData) {
        movementsData.forEach(movement => {
          if (!lastMovementMap.has(movement.product_id)) {
            lastMovementMap.set(movement.product_id, movement.created_at);
          }
          movementCountMap.set(
            movement.product_id, 
            (movementCountMap.get(movement.product_id) || 0) + 1
          );
        });
      }

      const productsSummary: ProductSummary[] = (productsData || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        current_stock: product.stock?.reduce((sum: number, s: any) => sum + (s.qty || 0), 0) || 0,
        unit: product.unit,
        total_movements: movementCountMap.get(product.id) || 0,
        last_movement: lastMovementMap.get(product.id) || ''
      }));

      setProducts(productsSummary);
    } catch (error) {
      console.error("Error fetching products:", error);
      showError("Error", "No se pudieron cargar los productos");
    }
  };

  const fetchKardex = async (productId: string) => {
    if (!productId) return;
    
    const supabase = createClient();
    setLoading(true);
    
    try {
      const { data: movementsData, error: movementsError } = await supabase
        .from("inventory_movements")
        .select(`
          id,
          created_at,
          movement_type,
          quantity,
          reason,
          notes,
          product:products(name, sku),
          warehouse:warehouses(name, code)
        `)
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

      if (movementsError) throw movementsError;

      // Calcular balance acumulado
      let runningBalance = 0;
      const kardexData: KardexEntry[] = (movementsData || []).map((movement: any) => {
        if (movement.movement_type === 'IN') {
          runningBalance += movement.quantity;
        } else if (movement.movement_type === 'OUT') {
          runningBalance -= movement.quantity;
        } else { // ADJUSTMENT
          runningBalance = movement.quantity;
        }

        return {
          id: movement.id,
          created_at: movement.created_at,
          movement_type: movement.movement_type,
          quantity: movement.quantity,
          reason: movement.reason,
          notes: movement.notes,
          warehouse_name: (movement.warehouse as any)?.name || 'Almacén eliminado',
          warehouse_code: (movement.warehouse as any)?.code || 'N/A',
          balance: runningBalance,
          product_name: (movement.product as any)?.name || 'Producto eliminado',
          product_sku: (movement.product as any)?.sku || 'N/A'
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

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Movimiento</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                >
                  <option value="">Todos los tipos</option>
                  <option value="IN">📈 Entradas</option>
                  <option value="OUT">📉 Salidas</option>
                  <option value="ADJUSTMENT">🔄 Ajustes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Fecha</label>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearch("");
                    setDateFilter("");
                    setTypeFilter("");
                  }}
                  className="w-full"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
              </div>

              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    // Exportar kardex (simplificado)
                    const csvContent = [
                      ['Fecha', 'Tipo', 'Cantidad', 'Razón', 'Almacén', 'Balance', 'Notas'].join(','),
                      ...filteredEntries.map(entry => [
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
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </div>
          </div>

          {/* Tabla de kardex */}
          <div className="border rounded-lg overflow-hidden bg-card">
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
                        <div className={`font-medium ${
                          entry.movement_type === 'IN' ? 'text-green-600' :
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

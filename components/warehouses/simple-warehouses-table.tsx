"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Warehouse, Package, MapPin, BarChart3, X } from "lucide-react";

interface WarehouseWithStats {
  id: string;
  code: string;
  name: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Estadísticas calculadas
  productCount?: number;
  totalStock?: number;
  stockValue?: number;
  utilizationRate?: number;
}

export function SimpleWarehousesTable() {
  const [warehouses, setWarehouses] = useState<WarehouseWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseWithStats | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseWithStats | null>(null);
  const [showStockDetail, setShowStockDetail] = useState(false);
  const { success, error: showError } = useToast();

  const fetchWarehouses = async () => {
    const supabase = createClient();
    try {
      // Obtener almacenes
      const { data: warehousesData, error: warehousesError } = await supabase
        .from("warehouses")
        .select("*")
        .order("created_at", { ascending: false });

      if (warehousesError) throw warehousesError;

      // Obtener stock por almacén con información de productos
      const { data: stockData, error: stockError } = await supabase
        .from("stock")
        .select(`
          warehouse_id,
          qty,
          product:products(id, name, price, is_active)
        `);

      if (stockError) {
        console.warn("No se pudo obtener información de stock:", stockError);
      }

      // Enriquecer almacenes con estadísticas
      const enrichedWarehouses = (warehousesData || []).map((warehouse: any) => {
        const warehouseStock = (stockData as any[])?.filter((s: any) => s.warehouse_id === warehouse.id) || [];
        const activeProductStock = warehouseStock.filter((s: any) => s.product && (s.product as any).is_active);
        
        const productCount = new Set(activeProductStock.map((s: any) => (s.product as any).id)).size;
        const totalStock = activeProductStock.reduce((sum: number, s: any) => sum + (s.qty || 0), 0);
        const stockValue = activeProductStock.reduce((sum: number, s: any) => 
          sum + ((s.qty || 0) * ((s.product as any).price || 0)), 0
        );
        
        // Tasa de utilización basada en productos únicos (máximo 100 productos por almacén)
        const utilizationRate = Math.min((productCount / 100) * 100, 100);

        return {
          ...warehouse,
          productCount,
          totalStock,
          stockValue,
          utilizationRate
        };
      });

      setWarehouses(enrichedWarehouses);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
      showError("Error", "No se pudieron cargar los almacenes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  // Funciones para manejar almacenes
  const handleEdit = (warehouse: WarehouseWithStats) => {
    setEditingWarehouse(warehouse);
    setIsModalOpen(true);
  };

  const handleDelete = async (warehouseId: string) => {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("warehouses")
        .delete()
        .eq("id", warehouseId);

      if (error) throw error;
      
      success("Almacén eliminado", "El almacén se eliminó correctamente");
      fetchWarehouses();
    } catch (error) {
      console.error("Error deleting warehouse:", error);
      showError("Error", "No se pudo eliminar el almacén");
    }
  };

  const handleSave = async (warehouseData: any) => {
    const supabase = createClient();
    try {
      if (editingWarehouse) {
        // Actualizar almacén existente
        const { error } = await supabase
          .from("warehouses")
          .update(warehouseData)
          .eq("id", editingWarehouse.id);

        if (error) throw error;
        success("Almacén actualizado", "El almacén se actualizó correctamente");
      } else {
        // Crear nuevo almacén
        const { error } = await supabase
          .from("warehouses")
          .insert([warehouseData]);

        if (error) throw error;
        success("Almacén creado", "El almacén se creó correctamente");
      }
      
      setIsModalOpen(false);
      setEditingWarehouse(null);
      fetchWarehouses();
    } catch (error) {
      console.error("Error saving warehouse:", error);
      showError("Error", "No se pudo guardar el almacén");
    }
  };

  const handleNew = () => {
    setEditingWarehouse(null);
    setIsModalOpen(true);
  };

  const handleViewStock = (warehouse: WarehouseWithStats) => {
    setSelectedWarehouse(warehouse);
    setShowStockDetail(true);
  };

  const filteredWarehouses = warehouses.filter(warehouse =>
    warehouse.name.toLowerCase().includes(search.toLowerCase()) ||
    warehouse.code.toLowerCase().includes(search.toLowerCase()) ||
    (warehouse.address && warehouse.address.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalWarehouses = warehouses.length;
  const activeWarehouses = warehouses.filter(w => w.is_active).length;
  const totalStock = warehouses.reduce((sum, w) => sum + (w.totalStock || 0), 0);
  const totalValue = warehouses.reduce((sum, w) => sum + (w.stockValue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Warehouse className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-foreground">{totalWarehouses}</div>
              <div className="text-sm text-muted-foreground">Total Almacenes</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Warehouse className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-600">{activeWarehouses}</div>
              <div className="text-sm text-muted-foreground">Almacenes Activos</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-orange-600" />
            <div>
              <div className="text-2xl font-bold text-orange-600">{totalStock}</div>
              <div className="text-sm text-muted-foreground">Stock Total</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <div>
              <div className="text-2xl font-bold text-purple-600">${totalValue.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Valor Total Stock</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar almacenes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Button onClick={fetchWarehouses} variant="outline">
            Actualizar
          </Button>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Almacén
          </Button>
        </div>
      </div>

      {/* Tabla mejorada */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Almacén</th>
              <th className="text-center p-4 font-medium">Stock</th>
              <th className="text-right p-4 font-medium">Valor</th>
              <th className="text-center p-4 font-medium">Utilización</th>
              <th className="text-center p-4 font-medium">Estado</th>
              <th className="text-center p-4 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredWarehouses.map((warehouse) => (
              <tr key={warehouse.id} className="border-t hover:bg-muted/25 transition-colors">
                <td className="p-4">
                  <div>
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <Warehouse className="h-4 w-4 text-muted-foreground" />
                      {warehouse.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Código: {warehouse.code}
                    </div>
                    {warehouse.address && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        {warehouse.address}
                      </div>
                    )}
                  </div>
                </td>
                
                <td className="p-4 text-center">
                  <div className="font-medium text-lg">
                    {warehouse.totalStock || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {warehouse.productCount || 0} productos únicos
                  </div>
                </td>
                
                <td className="p-4 text-right">
                  <div className="font-medium">
                    ${(warehouse.stockValue || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    valor inventario
                  </div>
                </td>
                
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          (warehouse.utilizationRate || 0) > 80 ? 'bg-red-500' :
                          (warehouse.utilizationRate || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${warehouse.utilizationRate || 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(warehouse.utilizationRate || 0).toFixed(1)}%
                  </div>
                </td>
                
                <td className="p-4 text-center">
                  <Badge variant={warehouse.is_active ? "default" : "secondary"}>
                    {warehouse.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewStock(warehouse)}
                    >
                      Ver Stock
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(warehouse)}
                    >
                      Editar
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        if (confirm(`¿Estás seguro de eliminar "${warehouse.name}"?`)) {
                          handleDelete(warehouse.id);
                        }
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredWarehouses.length === 0 && (
          <div className="text-center py-12">
            <Warehouse className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-lg font-medium text-muted-foreground mb-2">
              {warehouses.length === 0 
                ? "No hay almacenes registrados" 
                : "No se encontraron almacenes"
              }
            </div>
            <div className="text-sm text-muted-foreground">
              {warehouses.length === 0 
                ? "Comienza creando tu primer almacén" 
                : "Intenta con otros términos de búsqueda"
              }
            </div>
          </div>
        )}
      </div>

      {/* Footer con información */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <div>
          Mostrando {filteredWarehouses.length} de {warehouses.length} almacenes
        </div>
        <div>
          Última actualización: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Modal para crear/editar almacén */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {editingWarehouse ? "Editar Almacén" : "Nuevo Almacén"}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <WarehouseForm
              warehouse={editingWarehouse}
              onSave={handleSave}
              onCancel={() => setIsModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Modal para ver detalle de stock */}
      {showStockDetail && selectedWarehouse && (
        <WarehouseStockDetail
          warehouse={selectedWarehouse}
          onClose={() => setShowStockDetail(false)}
        />
      )}
    </div>
  );
}

// Formulario para almacenes
function WarehouseForm({ 
  warehouse, 
  onSave, 
  onCancel 
}: { 
  warehouse: WarehouseWithStats | null;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    code: warehouse?.code || "",
    name: warehouse?.name || "",
    address: warehouse?.address || "",
    is_active: warehouse?.is_active ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Código *</label>
        <Input
          value={formData.code}
          onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
          placeholder="Ej: ALM001"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Nombre *</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          placeholder="Ej: Almacén Principal"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Dirección</label>
        <textarea
          value={formData.address}
          onChange={(e) => setFormData({...formData, address: e.target.value})}
          placeholder="Dirección completa del almacén"
          className="w-full px-3 py-2 border border-input rounded-md bg-background min-h-[80px] resize-none"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
        />
        <label htmlFor="is_active" className="text-sm font-medium">Almacén activo</label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {warehouse ? "Actualizar" : "Crear"}
        </Button>
      </div>
    </form>
  );
}

// Componente para mostrar detalle de stock por almacén
function WarehouseStockDetail({ 
  warehouse, 
  onClose 
}: { 
  warehouse: WarehouseWithStats;
  onClose: () => void;
}) {
  const [stockDetails, setStockDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStockDetails = async () => {
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from("stock")
          .select(`
            qty,
            product:products(
              id,
              name,
              sku,
              price,
              unit,
              category:categories(name)
            )
          `)
          .eq("warehouse_id", warehouse.id)
          .gt("qty", 0)
          .order("qty", { ascending: false });

        if (error) throw error;
        setStockDetails(data || []);
      } catch (error) {
        console.error("Error fetching stock details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStockDetails();
  }, [warehouse.id]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            Stock en {warehouse.name} ({warehouse.code})
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-3">Producto</th>
                  <th className="text-left p-3">SKU</th>
                  <th className="text-left p-3">Categoría</th>
                  <th className="text-right p-3">Cantidad</th>
                  <th className="text-right p-3">Precio Unit.</th>
                  <th className="text-right p-3">Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {stockDetails.map((item, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-3 font-medium">{item.product?.name}</td>
                    <td className="p-3">
                      <code className="bg-muted px-2 py-1 rounded text-xs">
                        {item.product?.sku}
                      </code>
                    </td>
                    <td className="p-3">
                      {item.product?.category?.name || "Sin categoría"}
                    </td>
                    <td className="p-3 text-right">
                      {item.qty} {item.product?.unit}
                    </td>
                    <td className="p-3 text-right">
                      ${item.product?.price?.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-medium">
                      ${(item.qty * item.product?.price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {stockDetails.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay stock en este almacén
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

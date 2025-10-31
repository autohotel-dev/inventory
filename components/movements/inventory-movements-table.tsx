"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, TrendingUp, TrendingDown, RotateCcw, Package, X, Calendar } from "lucide-react";

interface InventoryMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  notes?: string;
  created_at: string;
  created_by?: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
}

export function InventoryMovementsTable() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [movementReasons, setMovementReasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { success, error: showError } = useToast();

  const fetchMovements = async () => {
    const supabase = createClient();
    try {
      // Obtener movimientos con relaciones
      const { data: movementsData, error: movementsError } = await supabase
        .from("inventory_movements")
        .select(`
          *,
          product:products(id, name, sku, unit),
          warehouse:warehouses(id, name, code)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (movementsError) throw movementsError;

      // Obtener productos para el formulario
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("is_active", true)
        .order("name");

      if (!productsError && productsData) {
        setProducts(productsData);
      }

      // Obtener almacenes para el formulario
      const { data: warehousesData, error: warehousesError } = await supabase
        .from("warehouses")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");

      if (!warehousesError && warehousesData) {
        setWarehouses(warehousesData);
      }

      // Obtener razones de movimiento
      const { data: reasonsData, error: reasonsError } = await supabase
        .from("movement_reasons")
        .select("id, movement_type, name, description")
        .eq("is_active", true)
        .order("movement_type, name");

      if (reasonsError) {
        console.error("Error loading movement reasons:", reasonsError);
      } else {
        setMovementReasons(reasonsData || []);
      }

      setMovements(movementsData || []);
    } catch (error) {
      console.error("Error fetching movements:", error);
      showError("Error", "No se pudieron cargar los movimientos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  const handleNew = () => {
    setIsModalOpen(true);
  };

  const handleSave = async (movementData: any) => {
    const supabase = createClient();
    try {
      // Preparar datos del movimiento
      const movementToSave = {
        ...movementData,
        reason_id: parseInt(movementData.reason_id),
        quantity: parseInt(movementData.quantity)
      };

      // Crear movimiento
      const { data: movement, error: movementError } = await supabase
        .from("inventory_movements")
        .insert([movementToSave])
        .select()
        .single();

      if (movementError) throw movementError;

      // Actualizar stock en la tabla stock
      const { data: currentStock, error: stockError } = await supabase
        .from("stock")
        .select("qty")
        .eq("product_id", movementData.product_id)
        .eq("warehouse_id", movementData.warehouse_id)
        .single();

      let newQuantity = 0;
      if (movementData.movement_type === 'IN') {
        newQuantity = (currentStock?.qty || 0) + movementData.quantity;
      } else if (movementData.movement_type === 'OUT') {
        newQuantity = Math.max(0, (currentStock?.qty || 0) - movementData.quantity);
      } else { // ADJUSTMENT
        newQuantity = movementData.quantity;
      }

      // Upsert stock
      const { error: updateStockError } = await supabase
        .from("stock")
        .upsert({
          product_id: movementData.product_id,
          warehouse_id: movementData.warehouse_id,
          qty: newQuantity
        });

      if (updateStockError) throw updateStockError;

      success("Movimiento registrado", "El movimiento se registró y el stock se actualizó");
      setIsModalOpen(false);
      fetchMovements();
    } catch (error) {
      console.error("Error saving movement:", error);
      showError("Error", "No se pudo registrar el movimiento");
    }
  };

  const filteredMovements = movements.filter(movement => {
    const matchesSearch = search === "" || 
      movement.product?.name.toLowerCase().includes(search.toLowerCase()) ||
      movement.product?.sku.toLowerCase().includes(search.toLowerCase()) ||
      movement.warehouse?.name.toLowerCase().includes(search.toLowerCase()) ||
      movement.reason.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === "" || movement.movement_type === typeFilter;

    const matchesDate = dateFilter === "" || 
      new Date(movement.created_at).toDateString() === new Date(dateFilter).toDateString();

    return matchesSearch && matchesType && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalMovements = movements.length;
  const inMovements = movements.filter(m => m.movement_type === 'IN').length;
  const outMovements = movements.filter(m => m.movement_type === 'OUT').length;
  const adjustments = movements.filter(m => m.movement_type === 'ADJUSTMENT').length;

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-foreground">{totalMovements}</div>
              <div className="text-sm text-muted-foreground">Total Movimientos</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-600">{inMovements}</div>
              <div className="text-sm text-muted-foreground">Entradas</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <TrendingDown className="h-5 w-5 text-red-600" />
            <div>
              <div className="text-2xl font-bold text-red-600">{outMovements}</div>
              <div className="text-sm text-muted-foreground">Salidas</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <RotateCcw className="h-5 w-5 text-orange-600" />
            <div>
              <div className="text-2xl font-bold text-orange-600">{adjustments}</div>
              <div className="text-sm text-muted-foreground">Ajustes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controles y filtros */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar movimientos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Button onClick={fetchMovements} variant="outline">
              Actualizar
            </Button>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Movimiento
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
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
                setTypeFilter("");
                setDateFilter("");
              }}
              className="w-full"
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Fecha/Hora</th>
              <th className="text-left p-4 font-medium">Producto</th>
              <th className="text-left p-4 font-medium">Almacén</th>
              <th className="text-center p-4 font-medium">Tipo</th>
              <th className="text-right p-4 font-medium">Cantidad</th>
              <th className="text-left p-4 font-medium">Razón</th>
            </tr>
          </thead>
          <tbody>
            {filteredMovements.map((movement) => (
              <tr key={movement.id} className="border-t hover:bg-muted/25 transition-colors">
                <td className="p-4">
                  <div className="text-sm">
                    <div className="font-medium">
                      {new Date(movement.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-muted-foreground">
                      {new Date(movement.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </td>
                
                <td className="p-4">
                  <div>
                    <div className="font-medium">{movement.product?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      SKU: {movement.product?.sku}
                    </div>
                  </div>
                </td>
                
                <td className="p-4">
                  <div>
                    <div className="font-medium">{movement.warehouse?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {movement.warehouse?.code}
                    </div>
                  </div>
                </td>
                
                <td className="p-4 text-center">
                  <Badge 
                    variant={
                      movement.movement_type === 'IN' ? 'default' :
                      movement.movement_type === 'OUT' ? 'destructive' : 'secondary'
                    }
                  >
                    {movement.movement_type === 'IN' && '📈 Entrada'}
                    {movement.movement_type === 'OUT' && '📉 Salida'}
                    {movement.movement_type === 'ADJUSTMENT' && '🔄 Ajuste'}
                  </Badge>
                </td>
                
                <td className="p-4 text-right">
                  <div className={`font-medium ${
                    movement.movement_type === 'IN' ? 'text-green-600' :
                    movement.movement_type === 'OUT' ? 'text-red-600' : 'text-orange-600'
                  }`}>
                    {movement.movement_type === 'OUT' ? '-' : '+'}{movement.quantity}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {movement.product?.unit}
                  </div>
                </td>
                
                <td className="p-4">
                  <div className="font-medium">{movement.reason}</div>
                  {movement.notes && (
                    <div className="text-sm text-muted-foreground">
                      {movement.notes}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredMovements.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-lg font-medium text-muted-foreground mb-2">
              {movements.length === 0 
                ? "No hay movimientos registrados" 
                : "No se encontraron movimientos"
              }
            </div>
            <div className="text-sm text-muted-foreground">
              {movements.length === 0 
                ? "Los movimientos aparecerán aquí cuando registres cambios de stock" 
                : "Intenta con otros filtros de búsqueda"
              }
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <div>
          Mostrando {filteredMovements.length} de {movements.length} movimientos
        </div>
        <div>
          Últimos 100 movimientos
        </div>
      </div>

      {/* Modal para nuevo movimiento */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Nuevo Movimiento</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <MovementForm
              products={products}
              warehouses={warehouses}
              movementReasons={movementReasons}
              onSave={handleSave}
              onCancel={() => setIsModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Formulario para movimientos
function MovementForm({ 
  products,
  warehouses,
  movementReasons,
  onSave, 
  onCancel 
}: { 
  products: any[];
  warehouses: any[];
  movementReasons: any[];
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    product_id: "",
    warehouse_id: "",
    movement_type: "IN" as 'IN' | 'OUT' | 'ADJUSTMENT',
    quantity: 0,
    reason_id: "",
    reason: "",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Producto *</label>
        <select
          value={formData.product_id}
          onChange={(e) => setFormData({...formData, product_id: e.target.value})}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
          required
        >
          <option value="">Seleccionar producto</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.sku})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Almacén *</label>
        <select
          value={formData.warehouse_id}
          onChange={(e) => setFormData({...formData, warehouse_id: e.target.value})}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
          required
        >
          <option value="">Seleccionar almacén</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name} ({warehouse.code})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tipo de Movimiento *</label>
        <select
          value={formData.movement_type}
          onChange={(e) => setFormData({...formData, movement_type: e.target.value as any})}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
          required
        >
          <option value="IN">📈 Entrada (Agregar stock)</option>
          <option value="OUT">📉 Salida (Quitar stock)</option>
          <option value="ADJUSTMENT">🔄 Ajuste (Establecer cantidad exacta)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          {formData.movement_type === 'ADJUSTMENT' ? 'Cantidad Final *' : 'Cantidad *'}
        </label>
        <Input
          type="number"
          min="1"
          value={formData.quantity}
          onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
          placeholder={formData.movement_type === 'ADJUSTMENT' ? 'Cantidad que quedará' : 'Cantidad a mover'}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Razón *</label>
        <select
          value={formData.reason_id}
          onChange={(e) => {
            const selectedReason = movementReasons.find(r => r.id === parseInt(e.target.value));
            setFormData({
              ...formData, 
              reason_id: e.target.value,
              reason: selectedReason?.name || ""
            });
          }}
          className="w-full px-3 py-2 border border-input rounded-md bg-background"
          required
        >
          <option value="">Seleccionar razón</option>
          {movementReasons
            .filter(reason => reason.movement_type === formData.movement_type)
            .map((reason) => (
              <option key={reason.id} value={reason.id}>
                {reason.name}
                {reason.description && ` - ${reason.description}`}
              </option>
            ))
          }
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Notas</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          placeholder="Información adicional sobre el movimiento"
          className="w-full px-3 py-2 border border-input rounded-md bg-background min-h-[80px] resize-none"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          Registrar Movimiento
        </Button>
      </div>
    </form>
  );
}

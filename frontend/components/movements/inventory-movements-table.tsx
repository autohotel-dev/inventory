"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, TrendingUp, TrendingDown, RotateCcw, Package, ArrowDownCircle, X, Filter, Calendar, User } from "lucide-react";
import Link from "next/link";
import { useUserRole } from "@/hooks/use-user-role";
import { TablePagination } from "@/components/ui/table-pagination";

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
  employee_name?: string;
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
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const { success, error: showError } = useToast();
  const { isReceptionist, isAdmin, isManager } = useUserRole();
  const canCreateMovement = isReceptionist || isAdmin || isManager;

  const fetchMovements = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("inventory_movements")
        .select(`
          *,
          product:products(id, name, sku, unit),
          warehouse:warehouses(id, name, code)
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      // Server-side filters
      if (typeFilter) query = query.eq("movement_type", typeFilter);
      if (productFilter) query = query.eq("product_id", productFilter);
      if (dateFilter) {
        const dayStart = new Date(dateFilter);
        const dayEnd = new Date(dateFilter);
        dayEnd.setDate(dayEnd.getDate() + 1);
        query = query.gte("created_at", dayStart.toISOString()).lt("created_at", dayEnd.toISOString());
      }
      if (search) {
        query = query.or(`reason.ilike.%${search}%,notes.ilike.%${search}%`);
      }

      query = query.range(from, to);

      const { data: movementsData, error: movementsError, count } = await query;

      if (movementsError) throw movementsError;
      setTotalCount(count || 0);

      // Resolve created_by UUIDs to employee names
      const uniqueUserIds = [...new Set((movementsData || []).map((m: any) => m.created_by).filter(Boolean))];
      const employeeMap = new Map<string, string>();
      if (uniqueUserIds.length > 0) {
        const { data: employees } = await supabase
          .from("employees")
          .select("auth_user_id, first_name, last_name")
          .in("auth_user_id", uniqueUserIds);
        if (employees) {
          employees.forEach((e: any) => {
            employeeMap.set(e.auth_user_id, `${e.first_name} ${e.last_name}`.trim());
          });
        }
      }

      const enrichedMovements = (movementsData || []).map((m: any) => ({
        ...m,
        employee_name: m.created_by ? employeeMap.get(m.created_by) || undefined : undefined,
      }));

      setMovements(enrichedMovements);
    } catch (error) {
      console.error("Error fetching movements:", error);
      showError("Error", "No se pudieron cargar los movimientos");
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, typeFilter, productFilter, dateFilter, search]);

  const fetchProducts = async () => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  useEffect(() => {
    fetchMovements();
    fetchProducts();
  }, [fetchMovements]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, productFilter, dateFilter, search]);



  // Client-side search is now done server-side via the .or() query
  // filteredMovements = movements (already filtered server-side)
  const filteredMovements = movements;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalMovements = totalCount;
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
            {canCreateMovement && (
              <Link href="/movements/new">
                <Button id="btn-new-transfer">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Movimiento
                </Button>
              </Link>
            )}
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
              <span className={typeFilter ? 'text-blue-400' : 'text-muted-foreground'}>Tipo de Movimiento</span>
            </label>
            <div className="relative group">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-blue-500/30 focus:outline-none hover:bg-background shadow-sm"
              >
                <option value="">✨ Todos los tipos</option>
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

          {/* Producto */}
          <div className={`relative p-4 rounded-xl border transition-all duration-300 ${productFilter ? 'bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/30 shadow-lg shadow-green-500/5' : 'bg-muted/30 border-border/50 hover:border-green-500/30 hover:bg-green-500/5'}`}>
            <label className="flex items-center gap-2 text-sm font-medium mb-3">
              <div className={`p-1.5 rounded-lg ${productFilter ? 'bg-green-500 text-white' : 'bg-green-500/10 text-green-500'}`}>
                <Package className="h-3.5 w-3.5" />
              </div>
              <span className={productFilter ? 'text-green-400' : 'text-muted-foreground'}>Producto</span>
            </label>
            <div className="relative group">
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-green-500/30 focus:outline-none hover:bg-background shadow-sm"
              >
                <option value="">📦 Todos los productos</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:translate-y-[-45%]">
                <div className={`p-1 rounded-md ${productFilter ? 'bg-green-500/20' : 'bg-muted'}`}>
                  <ArrowDownCircle className={`h-4 w-4 ${productFilter ? 'text-green-500' : 'text-muted-foreground'}`} />
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
            {(typeFilter || dateFilter || search || productFilter) ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("");
                  setDateFilter("");
                  setProductFilter("");
                }}
                className="w-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 gap-2 transition-colors"
              >
                <X className="h-4 w-4" />
                Limpiar filtros
              </Button>
            ) : (
              <div className="w-full p-4 rounded-xl border border-dashed border-border/50 bg-muted/10 flex items-center justify-center">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Sin filtros activos
                </span>
              </div>
            )}
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
              <th className="text-left p-4 font-medium">Responsable</th>
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
                  <div className={`font-medium ${movement.movement_type === 'IN' ? 'text-green-600' :
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

                <td className="p-4">
                  {movement.employee_name ? (
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{movement.employee_name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
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

      {/* Footer with pagination */}
      <div className="mt-4">
        <TablePagination
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>


    </div>
  );
}



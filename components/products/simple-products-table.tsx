"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Package, DollarSign, AlertTriangle, X, Scan, Trash2, Edit } from "lucide-react";
import type { SimpleProduct, ProductView } from "@/lib/types/inventory";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ProductModalForm } from "./product-modal-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ITEMS_PER_PAGE = 20;

export function SimpleProductsTable() {
  const [products, setProducts] = useState<ProductView[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState(""); // Input value (immediate)
  const [debouncedSearch, setDebouncedSearch] = useState(""); // Fetch trigger (delayed)
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Debounce effect for search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 800); // 800ms delay for better typing experience

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SimpleProduct | null>(null);

  // Delete Dialog State
  const [deleteProduct, setDeleteProduct] = useState<{ id: string, name: string } | null>(null);

  // Loading States
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { success, error: showError } = useToast();

  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    lowStockProducts: 0,
    criticalStockProducts: 0,
    totalValue: 0
  });

  // Fetch global statistics separate from pagination
  const fetchStats = async () => {
    const supabase = createClient();
    try {
      // 1. Total Products
      const { count: total, error: err1 } = await supabase
        .from("products_view")
        .select("*", { count: "exact", head: true });

      // 2. Active Products
      const { count: active, error: err2 } = await supabase
        .from("products_view")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // 3. Stock Status counts
      const { count: low, error: err3 } = await supabase
        .from("products_view")
        .select("*", { count: "exact", head: true })
        .or("stock_status.eq.low,stock_status.eq.critical");

      const { count: critical, error: err4 } = await supabase
        .from("products_view")
        .select("*", { count: "exact", head: true })
        .eq("stock_status", "critical");

      // 4. Total Value
      const { data: valueData, error: err5 } = await supabase
        .from("products_view")
        .select("inventory_value");

      if (err1 || err2 || err3 || err4 || err5) throw new Error("Error fetching stats");

      const totalVal = (valueData || []).reduce((sum, item) => sum + (item.inventory_value || 0), 0);

      setStats({
        totalProducts: total || 0,
        activeProducts: active || 0,
        lowStockProducts: low || 0,
        criticalStockProducts: critical || 0,
        totalValue: totalVal
      });

    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Fetch Logic Effect
  useEffect(() => {
    // Only fetch if filters actually changed logic (optional optimization)
    // But resetAndFetch handles reset.
    resetAndFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, categoryFilter, stockFilter, statusFilter]);

  // Removed old simple debounce useEffect

  const resetAndFetch = () => {
    setPage(0);
    // setProducts([]); // Don't clear products immediately to prevent flash
    setHasMore(true);
    fetchProducts(0, true);
  };

  const fetchProducts = async (pageNumber: number, isReset: boolean = false) => {
    if (!isReset && (!hasMore || loadingMore)) return;

    const supabase = createClient();
    if (pageNumber === 0) setLoading(true); // This sets 'loading' which we'll use for opacity
    else setLoadingMore(true);

    try {
      let query = supabase
        .from("products_view")
        .select("*")
        .order("created_at", { ascending: false });

      // Aplicar filtros
      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
      }
      if (categoryFilter) {
        if (categoryFilter === "sin-categoria") query = query.is("category_id", null);
        else query = query.eq("category_id", categoryFilter);
      }
      if (stockFilter) {
        if (stockFilter === "sin-stock") query = query.lte("total_stock", 0);
        else if (stockFilter === "stock-critico") query = query.eq("stock_status", "critical");
        else if (stockFilter === "stock-bajo") query = query.eq("stock_status", "low");
        else if (stockFilter === "stock-normal") query = query.eq("stock_status", "normal");
        else if (stockFilter === "stock-alto") query = query.eq("stock_status", "high");
      }
      if (statusFilter) {
        if (statusFilter === "activo") query = query.eq("is_active", true);
        else if (statusFilter === "inactivo") query = query.eq("is_active", false);
      }

      // Paginación
      const from = pageNumber * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error } = await query.range(from, to);

      if (error) throw error;

      if (data) {
        if (data.length < ITEMS_PER_PAGE) setHasMore(false);
        setProducts(prev => isReset ? data : [...prev, ...data]);
        setPage(pageNumber);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      showError("Error", "No se pudieron cargar los productos");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    fetchProducts(page + 1);
  };

  // Cargar datos iniciales auxiliares
  useEffect(() => {
    const fetchAuxCheck = async () => {
      const supabase = createClient();
      const { data: cat } = await supabase.from("categories").select("id, name").order("name");
      if (cat) setCategories(cat);

      const { data: sup } = await supabase.from("suppliers").select("id, name").eq("is_active", true).order("name");
      if (sup) setSuppliers(sup);
    };
    fetchAuxCheck();
  }, []);

  const handleEdit = async (viewProduct: ProductView) => {
    const supabase = createClient();
    const { data } = await supabase.from("products").select("*, category:categories(id, name)").eq("id", viewProduct.id).single();

    if (data) {
      setEditingProduct(data);
      setIsModalOpen(true);
    } else {
      showError("Error", "No se pudieron cargar los detalles del producto para editar");
    }
  };

  const confirmDelete = async () => {
    if (!deleteProduct) return;

    setIsDeleting(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", deleteProduct.id);

      if (error) throw error;

      success("Producto eliminado", "El producto se eliminó correctamente");
      resetAndFetch();
      fetchStats(); // Fix: Sync stats
    } catch (error) {
      console.error("Error deleting product:", error);
      showError("Error", "No se pudo eliminar el producto");
    } finally {
      setIsDeleting(false);
      setDeleteProduct(null);
    }
  };

  const handleSave = async (productData: any) => {
    setIsSaving(true);
    const supabase = createClient();
    try {
      if (editingProduct) {
        // Actualizar producto existente
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) throw error;
        success("Producto actualizado", "El producto se actualizó correctamente");
      } else {
        // Crear nuevo producto
        const { error } = await supabase
          .from("products")
          .insert([productData]);

        if (error) throw error;
        success("Producto creado", "El producto se creó correctamente");
      }

      setIsModalOpen(false);
      setEditingProduct(null);
      resetAndFetch();
      fetchStats(); // Fix: Sync stats
    } catch (error) {
      console.error("Error saving product:", error);
      showError("Error", "No se pudo guardar el producto");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNew = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  // Render simplificado: solo mostrar spinner si es la PRIMERA carga y no hay datos
  if (loading && products.length === 0 && page === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Replace client-side calculation variables with stats state
  // const totalValue = ... (removed)
  // const activeProducts = ... (removed)
  // etc.

  return (
    <div className="space-y-6">
      {/* Header con estadísticas Globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-white">{stats.totalProducts}</div>
            <div className="text-sm text-muted-foreground font-medium">Total Productos</div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="text-3xl font-bold text-emerald-500">{stats.activeProducts}</div>
            <div className="text-sm text-muted-foreground font-medium">Productos Activos</div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div className="text-3xl font-bold text-amber-500">{stats.lowStockProducts}</div>
            <div className="text-sm text-muted-foreground font-medium">
              Stock Bajo ({stats.criticalStockProducts} críticos)
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border shadow-sm flex items-center justify-center">
          <div className="flex flex-col gap-1 items-center text-center">
            <div className="text-3xl font-bold text-purple-500">
              ${stats.totalValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-muted-foreground font-medium">Valor Real Inventario</div>
          </div>
        </div>
      </div>

      {/* Controles y Filtros (Igual que antes pero los setters activan el fetch server-side) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por nombre, SKU o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={resetAndFetch} variant="outline">
              Actualizar
            </Button>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </div>

        {/* Filtros Avanzados (Igual JSX, lógica state ya conectada) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
          <div>
            <label className="block text-sm font-medium mb-2">Categoría</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="">Todas las categorías</option>
              <option value="sin-categoria">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Estado de Stock</label>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="">Todos los stocks</option>
              <option value="sin-stock">🔴 Sin stock</option>
              <option value="stock-critico">🔴 Stock crítico</option>
              <option value="stock-bajo">🟡 Stock bajo</option>
              <option value="stock-normal">✅ Stock normal</option>
              <option value="stock-alto">🟢 Stock alto</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Estado del Producto</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="">Todos los estados</option>
              <option value="activo">✅ Activos</option>
              <option value="inactivo">❌ Inactivos</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setCategoryFilter("");
                setStockFilter("");
                setStatusFilter("");
              }}
              className="w-full"
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>

        {/* Indicadores de filtro (Igual JSX) */}
        {(searchTerm || categoryFilter || stockFilter || statusFilter) && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Filtros activos:</span>
            {/* ... Badges igual que antes ... */}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className={`overflow-x-auto rounded-lg border border-border bg-card shadow-sm transition-opacity duration-300 ${loading && products.length > 0 ? "opacity-50" : "opacity-100"}`}>
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Producto</th>
              <th className="text-left p-4 font-medium">SKU</th>
              <th className="text-left p-4 font-medium">Categoría</th>
              <th className="text-right p-4 font-medium">Stock Real</th>
              <th className="text-right p-4 font-medium">Financiero</th>
              <th className="text-center p-4 font-medium">Estado</th>
              <th className="text-center p-4 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t hover:bg-muted/25 transition-colors">
                <td className="p-4">
                  <div>
                    <div className="font-medium text-foreground">{product.name}</div>
                    {product.description && (
                      <div className="text-sm text-muted-foreground truncate max-w-xs">
                        {product.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Unidad: {product.unit}
                    </div>
                  </div>
                </td>

                <td className="p-4">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                    {product.sku}
                  </code>
                  {product.barcode && (
                    <div className="text-xs text-muted-foreground mt-1">
                      CB: {product.barcode}
                    </div>
                  )}
                </td>

                <td className="p-4">
                  {product.category_name ? (
                    <Badge variant="secondary">
                      {product.category_name}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Sin categoría</span>
                  )}
                </td>

                <td className="p-4 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-bold text-foreground">
                      {Math.floor(product.total_stock)}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      Mín: {product.min_stock} {product.unit}
                    </span>
                    {/* Placeholder for warehouse count if available in future */}
                  </div>
                </td>

                <td className="p-4 text-center">
                  <div className="font-semibold text-foreground text-lg">${product.price.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">
                    Valor: ${(product.inventory_value).toFixed(2)}
                  </div>
                  {(() => {
                    const margin = product.cost > 0 ? ((product.price - product.cost) / product.cost) * 100 : 0;
                    return (
                      <div className={`text-xs font-medium ${margin > 50 ? 'text-emerald-500' : margin > 20 ? 'text-amber-500' : 'text-rose-500'}`}>
                        Margen: {margin.toFixed(1)}%
                      </div>
                    );
                  })()}
                </td>

                <td className="p-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    {/* Badge de Activo (Blanco/Negro) */}
                    <div className="bg-white text-black px-3 py-0.5 rounded-md text-xs font-bold border shadow-sm">
                      {product.is_active ? "Activo" : "Inactivo"}
                    </div>

                    {/* Badge de Stock (Pills) */}
                    {product.stock_status === 'critical' ? (
                      <div className="bg-red-900/80 text-white border border-red-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                        Sin Stock
                      </div>
                    ) : product.stock_status === 'low' ? (
                      <div className="bg-zinc-800 text-white border border-zinc-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                        Stock Bajo
                      </div>
                    ) : product.stock_status === 'high' ? (
                      <div className="bg-white text-black border border-gray-200 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        Stock Alto
                      </div>
                    ) : (
                      <div className="bg-zinc-800 text-white border border-zinc-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
                        {/* Green Checkbox Icon style */}
                        <div className="bg-emerald-500 rounded-[2px] p-[1px]">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-black">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                        Normal
                      </div>
                    )}
                  </div>
                </td>

                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(product)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteProduct({ id: product.id, name: product.name })}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Estado Vacío */}
        {products.length === 0 && !loading && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-lg font-medium text-muted-foreground mb-2">
              No se encontraron productos
            </div>
            <div className="text-sm text-muted-foreground">
              Intenta con otros términos de búsqueda o filtros
            </div>
          </div>
        )}

        {/* Botón Cargar Más */}
        {hasMore && products.length > 0 && (
          <div className="p-4 text-center border-t">
            <Button
              variant="ghost"
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              {loadingMore ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Cargando más...
                </div>
              ) : (
                "Cargar más productos"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Footer con información */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <div>
          Mostrando {products.length} productos
        </div>
        <div>
          {/* Info extra si se desea */}
        </div>
      </div>

      {/* Modal para crear/editar producto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {editingProduct ? "Editar Producto" : "Nuevo Producto"}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ProductModalForm
              product={editingProduct}
              categories={categories}
              suppliers={suppliers}
              onSave={handleSave}
              onCancel={() => setIsModalOpen(false)}
              isLoading={isSaving}
            />
          </div>
        </div>
      )}

      {/* Dialogo de Confirmación de Eliminación */}
      <AlertDialog open={!!deleteProduct} onOpenChange={(open) => !isDeleting && setDeleteProduct(open ? deleteProduct : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deseas eliminar este producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el producto
              <strong> {deleteProduct?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Eliminando...</span>
                </div>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

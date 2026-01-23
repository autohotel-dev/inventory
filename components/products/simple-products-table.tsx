"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePOSConfigRead } from "@/hooks/use-pos-config";
import { Plus, Search, Package, DollarSign, AlertTriangle, X, Scan, Trash2, Edit, BarChart3, Filter, Barcode, Tag, Layers, Truck, CheckCircle2, XCircle, ArrowDownCircle, Calendar } from "lucide-react";
import type { SimpleProduct, ProductView } from "@/lib/types/inventory";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ProductModalForm } from "./product-modal-form";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [debouncedPriceMin, setDebouncedPriceMin] = useState("");
  const [debouncedPriceMax, setDebouncedPriceMax] = useState("");
  const [subcategories, setSubcategories] = useState<any[]>([]);

  // Refs para detección de escaneo
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastInputTimeRef = useRef<number>(0);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rapidInputRef = useRef<boolean>(false);

  // Configuración del sistema
  const posConfig = usePOSConfigRead();

  // Debounce effect for search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 800); // 800ms delay for better typing experience

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Debounce effect for price filters
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPriceMin(priceMin);
      setDebouncedPriceMax(priceMax);
    }, 800); // 800ms delay for better typing experience

    return () => clearTimeout(timer);
  }, [priceMin, priceMax]);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  // Estado para escaneo rápido (campo separado)
  const [quickScanValue, setQuickScanValue] = useState("");

  // Manejar escaneo rápido con Enter
  const handleQuickScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && quickScanValue.trim()) {
      e.preventDefault();
      // Buscar inmediatamente
      setSearchTerm(quickScanValue.trim());
      setDebouncedSearch(quickScanValue.trim());
      // Limpiar input para el siguiente escaneo
      setQuickScanValue("");
      // Re-enfocar
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (e.key === 'Escape') {
      setQuickScanValue("");
    }
  };

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

      const totalVal = (valueData || []).reduce((sum: number, item: any) => sum + (item.inventory_value || 0), 0);

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
  }, [debouncedSearch, categoryFilter, subcategoryFilter, supplierFilter, stockFilter, statusFilter, debouncedPriceMin, debouncedPriceMax]);

  // Fetch subcategories when category changes
  useEffect(() => {
    const fetchSubcategories = async () => {
      if (!categoryFilter || categoryFilter === "sin-categoria") {
        setSubcategories([]);
        setSubcategoryFilter("");
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("subcategories")
        .select("id, name")
        .eq("category_id", categoryFilter)
        .eq("is_active", true)
        .order("name");
      setSubcategories(data || []);
      setSubcategoryFilter(""); // Reset subcategory when category changes
    };
    fetchSubcategories();
  }, [categoryFilter]);

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
      if (subcategoryFilter) {
        if (subcategoryFilter === "sin-subcategoria") query = query.is("subcategory_id", null);
        else query = query.eq("subcategory_id", subcategoryFilter);
      }
      if (supplierFilter) {
        if (supplierFilter === "sin-proveedor") query = query.is("supplier_id", null);
        else query = query.eq("supplier_id", supplierFilter);
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
      // Filtro de rango de precio (con debounce)
      if (debouncedPriceMin) {
        query = query.gte("price", parseFloat(debouncedPriceMin));
      }
      if (debouncedPriceMax) {
        query = query.lte("price", parseFloat(debouncedPriceMax));
      }

      // Paginación
      const from = pageNumber * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error } = await query.range(from, to);

      if (error) throw error;

      if (data) {
        if (data.length < ITEMS_PER_PAGE) setHasMore(false);
        setProducts((prev: ProductView[]) => isReset ? data : [...prev, ...data]);
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
      {/* Header con estadísticas Globales - COLAPSABLE */}
      <CollapsibleSection
        storageKey="products-stats"
        title="Estadísticas de Inventario"
        icon={<BarChart3 className="h-4 w-4" />}
        defaultOpen={true}
        variant="minimal"
      >
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
      </CollapsibleSection>

      {/* Controles y Filtros (Igual que antes pero los setters activan el fetch server-side) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Búsqueda normal */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por nombre, SKU o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Escaneo Rápido */}
          <div className="relative flex-1 max-w-xs">
            <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary h-4 w-4" />
            <Input
              ref={searchInputRef}
              placeholder="Escanear código (Enter)..."
              value={quickScanValue}
              onChange={(e) => setQuickScanValue(e.target.value)}
              onKeyDown={handleQuickScan}
              className="pl-10 border-primary/30 focus:border-primary"
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

        {/* Filtros Avanzados - COLAPSABLE con diseño estilo Analytics */}
        <CollapsibleSection
          storageKey="products-filters"
          title="Filtros Avanzados"
          icon={<Filter className="h-4 w-4" />}
          defaultOpen={false}
          variant="default"
          badge={(() => {
            const count = [categoryFilter, subcategoryFilter, supplierFilter, stockFilter, statusFilter, priceMin, priceMax].filter(Boolean).length;
            return count > 0 ? `${count} activo${count > 1 ? 's' : ''}` : undefined;
          })()}
        >
          <div className="space-y-4">
            {/* Grid de filtros con diseño premium estilo Analytics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {/* Categoría */}
              <div className={`relative p-4 rounded-xl border transition-all duration-300 ${categoryFilter ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-muted/30 border-border/50 hover:border-blue-500/30 hover:bg-blue-500/5'}`}>
                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                  <div className={`p-1.5 rounded-lg ${categoryFilter ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500'}`}>
                    <Tag className="h-3.5 w-3.5" />
                  </div>
                  <span className={categoryFilter ? 'text-blue-400' : 'text-muted-foreground'}>Categoría</span>
                </label>
                <div className="relative group">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-blue-500/30 focus:outline-none hover:bg-background shadow-sm"
                  >
                    <option value="">✨ Todas las categorías</option>
                    <option value="sin-categoria">⚪ Sin categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        📁 {category.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:translate-y-[-45%]">
                    <div className={`p-1 rounded-md ${categoryFilter ? 'bg-blue-500/20' : 'bg-muted'}`}>
                      <ArrowDownCircle className={`h-4 w-4 ${categoryFilter ? 'text-blue-500' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Subcategoría */}
              <div className={`relative p-4 rounded-xl border transition-all duration-300 ${subcategoryFilter ? 'bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/30 shadow-lg shadow-purple-500/5' : 'bg-muted/30 border-border/50 hover:border-purple-500/30 hover:bg-purple-500/5'} ${(!categoryFilter || categoryFilter === 'sin-categoria') ? 'opacity-50' : ''}`}>
                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                  <div className={`p-1.5 rounded-lg ${subcategoryFilter ? 'bg-purple-500 text-white' : 'bg-purple-500/10 text-purple-500'}`}>
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                  <span className={subcategoryFilter ? 'text-purple-400' : 'text-muted-foreground'}>Subcategoría</span>
                </label>
                <div className="relative group">
                  <select
                    value={subcategoryFilter}
                    onChange={(e) => setSubcategoryFilter(e.target.value)}
                    disabled={!categoryFilter || categoryFilter === "sin-categoria"}
                    className="w-full pl-4 pr-10 py-2.5 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-purple-500/30 focus:outline-none hover:bg-background shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">✨ Todas las subcategorías</option>
                    {categoryFilter && categoryFilter !== "sin-categoria" && (
                      <option value="sin-subcategoria">⚪ Sin subcategoría</option>
                    )}
                    {subcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        📂 {subcategory.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:translate-y-[-45%]">
                    <div className={`p-1 rounded-md ${subcategoryFilter ? 'bg-purple-500/20' : 'bg-muted'}`}>
                      <ArrowDownCircle className={`h-4 w-4 ${subcategoryFilter ? 'text-purple-500' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Proveedor */}
              <div className={`relative p-4 rounded-xl border transition-all duration-300 ${supplierFilter ? 'bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/30 shadow-lg shadow-amber-500/5' : 'bg-muted/30 border-border/50 hover:border-amber-500/30 hover:bg-amber-500/5'}`}>
                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                  <div className={`p-1.5 rounded-lg ${supplierFilter ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-500'}`}>
                    <Truck className="h-3.5 w-3.5" />
                  </div>
                  <span className={supplierFilter ? 'text-amber-400' : 'text-muted-foreground'}>Proveedor</span>
                </label>
                <div className="relative group">
                  <select
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-amber-500/30 focus:outline-none hover:bg-background shadow-sm"
                  >
                    <option value="">✨ Todos los proveedores</option>
                    <option value="sin-proveedor">⚪ Sin proveedor</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        🏭 {supplier.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:translate-y-[-45%]">
                    <div className={`p-1 rounded-md ${supplierFilter ? 'bg-amber-500/20' : 'bg-muted'}`}>
                      <ArrowDownCircle className={`h-4 w-4 ${supplierFilter ? 'text-amber-500' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado de Stock */}
              <div className={`relative p-4 rounded-xl border transition-all duration-300 ${stockFilter ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/30 shadow-lg shadow-emerald-500/5' : 'bg-muted/30 border-border/50 hover:border-emerald-500/30 hover:bg-emerald-500/5'}`}>
                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                  <div className={`p-1.5 rounded-lg ${stockFilter ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    <Package className="h-3.5 w-3.5" />
                  </div>
                  <span className={stockFilter ? 'text-emerald-400' : 'text-muted-foreground'}>Stock</span>
                </label>
                <div className="relative group">
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none hover:bg-background shadow-sm"
                  >
                    <option value="">✨ Todos los niveles</option>
                    <option value="sin-stock">🔴 Sin stock</option>
                    <option value="stock-critico">🔴 Crítico</option>
                    <option value="stock-bajo">🟡 Bajo</option>
                    <option value="stock-normal">🟢 Normal</option>
                    <option value="stock-alto">🟢 Alto</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:translate-y-[-45%]">
                    <div className={`p-1 rounded-md ${stockFilter ? 'bg-emerald-500/20' : 'bg-muted'}`}>
                      <ArrowDownCircle className={`h-4 w-4 ${stockFilter ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado del Producto */}
              <div className={`relative p-4 rounded-xl border transition-all duration-300 ${statusFilter ? (statusFilter === 'activo' ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/30 shadow-lg shadow-emerald-500/5' : 'bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/30 shadow-lg shadow-red-500/5') : 'bg-muted/30 border-border/50 hover:border-indigo-500/30 hover:bg-indigo-500/5'}`}>
                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                  <div className={`p-1.5 rounded-lg ${statusFilter === 'activo' ? 'bg-emerald-500 text-white' : statusFilter === 'inactivo' ? 'bg-red-500 text-white' : 'bg-indigo-500/10 text-indigo-500'}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <span className={statusFilter === 'activo' ? 'text-emerald-400' : statusFilter === 'inactivo' ? 'text-red-400' : 'text-muted-foreground'}>Estado</span>
                </label>
                <div className="relative group">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none hover:bg-background shadow-sm"
                  >
                    <option value="">✨ Todos los estados</option>
                    <option value="activo">✅ Activos</option>
                    <option value="inactivo">❌ Inactivos</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:translate-y-[-45%]">
                    <div className={`p-1 rounded-md ${statusFilter === 'activo' ? 'bg-emerald-500/20' : statusFilter === 'inactivo' ? 'bg-red-500/20' : 'bg-muted'}`}>
                      <ArrowDownCircle className={`h-4 w-4 ${statusFilter === 'activo' ? 'text-emerald-500' : statusFilter === 'inactivo' ? 'text-red-500' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Precio Mínimo */}
              <div className={`relative p-4 rounded-xl border transition-all duration-300 ${priceMin ? 'bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/30 shadow-lg shadow-cyan-500/5' : 'bg-muted/30 border-border/50 hover:border-cyan-500/30 hover:bg-cyan-500/5'}`}>
                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                  <div className={`p-1.5 rounded-lg ${priceMin ? 'bg-cyan-500 text-white' : 'bg-cyan-500/10 text-cyan-500'}`}>
                    <DollarSign className="h-3.5 w-3.5" />
                  </div>
                  <span className={priceMin ? 'text-cyan-400' : 'text-muted-foreground'}>Precio Mín.</span>
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="border-0 bg-background/90 backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              {/* Precio Máximo */}
              <div className={`relative p-4 rounded-xl border transition-all duration-300 ${priceMax ? 'bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/30 shadow-lg shadow-cyan-500/5' : 'bg-muted/30 border-border/50 hover:border-cyan-500/30 hover:bg-cyan-500/5'}`}>
                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                  <div className={`p-1.5 rounded-lg ${priceMax ? 'bg-cyan-500 text-white' : 'bg-cyan-500/10 text-cyan-500'}`}>
                    <DollarSign className="h-3.5 w-3.5" />
                  </div>
                  <span className={priceMax ? 'text-cyan-400' : 'text-muted-foreground'}>Precio Máx.</span>
                </label>
                <Input
                  type="number"
                  placeholder="999.99"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="border-0 bg-background/90 backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>
            </div>

            {/* Botón limpiar filtros con estilo */}
            {(categoryFilter || subcategoryFilter || supplierFilter || stockFilter || statusFilter || priceMin || priceMax) && (
              <div className="flex justify-end pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setCategoryFilter("");
                    setSubcategoryFilter("");
                    setSupplierFilter("");
                    setStockFilter("");
                    setStatusFilter("");
                    setPriceMin("");
                    setPriceMax("");
                  }}
                  className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 gap-2 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Indicadores de filtro activos - Diseño moderno con chips coloridos */}
        {
          (searchTerm || categoryFilter || subcategoryFilter || supplierFilter || stockFilter || statusFilter || priceMin || priceMax) && (
            <div className="flex flex-wrap gap-2 items-center p-3 bg-gradient-to-r from-muted/50 to-muted/30 backdrop-blur-sm rounded-xl border border-border/50">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                Filtros:
              </span>
              {searchTerm && (
                <Badge className="gap-1.5 px-3 py-1.5 bg-gradient-to-r from-gray-600 to-gray-500 text-white border-0 shadow-md hover:shadow-lg transition-shadow cursor-default">
                  <Search className="h-3 w-3" />
                  <span className="font-normal">{searchTerm}</span>
                  <button onClick={() => setSearchTerm("")} className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {categoryFilter && (
                <Badge className="gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0 shadow-md hover:shadow-lg transition-shadow cursor-default">
                  <Tag className="h-3 w-3" />
                  <span className="font-normal">{categoryFilter === "sin-categoria" ? "Sin categoría" : categories.find(c => c.id === categoryFilter)?.name || categoryFilter}</span>
                  <button onClick={() => setCategoryFilter("")} className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {subcategoryFilter && (
                <Badge className="gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white border-0 shadow-md hover:shadow-lg transition-shadow cursor-default">
                  <Layers className="h-3 w-3" />
                  <span className="font-normal">{subcategoryFilter === "sin-subcategoria" ? "Sin subcategoría" : subcategories.find(s => s.id === subcategoryFilter)?.name || subcategoryFilter}</span>
                  <button onClick={() => setSubcategoryFilter("")} className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {supplierFilter && (
                <Badge className="gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 text-white border-0 shadow-md hover:shadow-lg transition-shadow cursor-default">
                  <Truck className="h-3 w-3" />
                  <span className="font-normal">{supplierFilter === "sin-proveedor" ? "Sin proveedor" : suppliers.find(s => s.id === supplierFilter)?.name || supplierFilter}</span>
                  <button onClick={() => setSupplierFilter("")} className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {stockFilter && (
                <Badge className="gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-0 shadow-md hover:shadow-lg transition-shadow cursor-default">
                  <Package className="h-3 w-3" />
                  <span className="font-normal capitalize">{stockFilter.replace("stock-", "").replace("sin-", "Sin ")}</span>
                  <button onClick={() => setStockFilter("")} className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {statusFilter && (
                <Badge className={`gap-1.5 px-3 py-1.5 text-white border-0 shadow-md hover:shadow-lg transition-shadow cursor-default ${statusFilter === 'activo' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500' : 'bg-gradient-to-r from-red-600 to-red-500'}`}>
                  {statusFilter === "activo" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  <span className="font-normal">{statusFilter === "activo" ? "Activos" : "Inactivos"}</span>
                  <button onClick={() => setStatusFilter("")} className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {(priceMin || priceMax) && (
                <Badge className="gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white border-0 shadow-md hover:shadow-lg transition-shadow cursor-default">
                  <DollarSign className="h-3 w-3" />
                  <span className="font-normal">
                    {priceMin && priceMax ? `$${priceMin} - $${priceMax}` : priceMin ? `Desde $${priceMin}` : `Hasta $${priceMax}`}
                  </span>
                  <button onClick={() => { setPriceMin(""); setPriceMax(""); }} className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )
        }
      </div >

      {/* Tabla */}
      < div className={`overflow-x-auto rounded-lg border border-border bg-card shadow-sm transition-opacity duration-300 ${loading && products.length > 0 ? "opacity-50" : "opacity-100"}`
      }>
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
                  <div className="space-y-1">
                    {product.category_name ? (
                      <Badge variant="secondary">
                        {product.category_name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Sin categoría</span>
                    )}
                    {(product as any).subcategory_name && (
                      <div>
                        <Badge variant="outline" className="text-xs">
                          ↳ {(product as any).subcategory_name}
                        </Badge>
                      </div>
                    )}
                  </div>
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
        {
          products.length === 0 && !loading && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <div className="text-lg font-medium text-muted-foreground mb-2">
                No se encontraron productos
              </div>
              <div className="text-sm text-muted-foreground">
                Intenta con otros términos de búsqueda o filtros
              </div>
            </div>
          )
        }

        {/* Botón Cargar Más */}
        {
          hasMore && products.length > 0 && (
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
          )
        }
      </div >

      {/* Footer con información */}
      < div className="flex justify-between items-center text-sm text-muted-foreground" >
        <div>
          Mostrando {products.length} productos
        </div>
        <div>
          {/* Info extra si se desea */}
        </div>
      </div >

      {/* Modal para crear/editar producto */}
      < Dialog open={isModalOpen} onOpenChange={(open) => !isSaving && setIsModalOpen(open)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
          </DialogHeader>
          <ProductModalForm
            product={editingProduct}
            categories={categories}
            suppliers={suppliers}
            onSave={handleSave}
            onCancel={() => setIsModalOpen(false)}
            isLoading={isSaving}
          />
        </DialogContent>
      </Dialog >

      {/* Dialogo de Confirmación de Eliminación */}
      < AlertDialog open={!!deleteProduct} onOpenChange={(open) => !isDeleting && setDeleteProduct(open ? deleteProduct : null)}>
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
      </AlertDialog >
    </div >
  );
}

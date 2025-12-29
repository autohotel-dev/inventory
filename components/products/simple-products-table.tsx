"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Package, DollarSign, AlertTriangle, X, Scan } from "lucide-react";
import type { SimpleProduct, ProductView } from "@/lib/types/inventory";
import { BarcodeScanner } from "@/components/barcode-scanner";

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
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SimpleProduct | null>(null);
  const { success, error: showError } = useToast();

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      resetAndFetch();
    }, 500);
    return () => clearTimeout(timer);
  }, [search, categoryFilter, stockFilter, statusFilter]);

  const resetAndFetch = () => {
    setPage(0);
    setProducts([]);
    setHasMore(true);
    fetchProducts(0, true);
  };

  const fetchProducts = async (pageNumber: number, isReset: boolean = false) => {
    if (!isReset && (!hasMore || loadingMore)) return;

    const supabase = createClient();
    if (pageNumber === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      let query = supabase
        .from("products_view")
        .select("*")
        .order("created_at", { ascending: false });

      // Aplicar filtros
      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);
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

  // Cargar datos iniciales auxiliares (categorías, proveedores)
  useEffect(() => {
    const fetchAuxCheck = async () => {
      const supabase = createClient();
      const { data: cat } = await supabase.from("categories").select("id, name").order("name");
      if (cat) setCategories(cat);

      const { data: sup } = await supabase.from("suppliers").select("id, name").eq("is_active", true).order("name");
      if (sup) setSuppliers(sup);
    };
    fetchAuxCheck();
    // fetchProducts se llama vía el useEffect de filtros
  }, []);

  // Funciones para manejar productos (CRUD)
  const handleEdit = async (viewProduct: ProductView) => {
    // Necesitamos obtener el objeto completo SimpleProduct para el formulario
    // ya que la vista es plana, pero el formulario espera estructura anidada o un objeto específico
    const supabase = createClient();
    const { data } = await supabase.from("products").select("*, category:categories(id, name)").eq("id", viewProduct.id).single();

    if (data) {
      setEditingProduct(data);
      setIsModalOpen(true);
    } else {
      showError("Error", "No se pudieron cargar los detalles del producto para editar");
    }
  };

  const handleDelete = async (productId: string) => {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) throw error;

      success("Producto eliminado", "El producto se eliminó correctamente");
      resetAndFetch();
    } catch (error) {
      console.error("Error deleting product:", error);
      showError("Error", "No se pudo eliminar el producto");
    }
  };

  const handleSave = async (productData: any) => {
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
    } catch (error) {
      console.error("Error saving product:", error);
      showError("Error", "No se pudo guardar el producto");
    }
  };

  const handleNew = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  // Render simplificado (no filters client-side)
  // ... (reutilizar el JSX anterior pero apuntando a `products` estado que ya es la vista)

  if (loading && page === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Calculos de totales para el header (OJO: Esto solo será de lo cargado si paginamos,
  // para totales reales necesitaríamos otra consulta aggregate, por ahora mostramos lo visible o lo quitamos/ajustamos)
  // Para mantener performance, quizás mejor quitar los totales globales o hacer consulta aparte.
  // Dejaremos los totales calculados sobre los productos CARGADOS por ahora, o idealmente hacer un .count()

  const totalLoadedValue = products.reduce((sum, p) => sum + (p.inventory_value || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header con estadísticas (De los productos visibles) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-foreground">{products.length}{hasMore ? "+" : ""}</div>
              <div className="text-sm text-muted-foreground">Productos Listados</div>
            </div>
          </div>
        </div>
        {/* ... Otros cards similares ... */}
      </div>

      {/* Controles y Filtros (Igual que antes pero los setters activan el fetch server-side) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por nombre, SKU o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
                setSearch("");
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
        {(search || categoryFilter || stockFilter || statusFilter) && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Filtros activos:</span>
            {/* ... Badges igual que antes ... */}
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
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

                <td className="p-4 text-right">
                  <div className="font-medium text-lg">
                    {Math.floor(product.total_stock)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Mín: {product.min_stock} {product.unit}
                  </div>
                </td>

                <td className="p-4 text-right">
                  <div className="font-medium">${product.price.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">
                    Valor: ${(product.inventory_value).toFixed(2)}
                  </div>
                </td>

                <td className="p-4 text-center">
                  <div className="space-y-1">
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                      {product.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                    <div>
                      <Badge
                        variant={
                          product.stock_status === 'critical' ? "destructive" :
                            product.stock_status === 'low' ? "secondary" :
                              product.stock_status === 'high' ? "default" : "outline"
                        }
                        className="text-xs"
                      >
                        {product.stock_status === 'critical' ? '🔴 Sin Stock' :
                          product.stock_status === 'low' ? '🟡 Stock Bajo' :
                            product.stock_status === 'high' ? '🟢 Stock Alto' : '✅ Normal'}
                      </Badge>
                    </div>
                  </div>
                </td>

                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(product)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm(`¿Estás seguro de eliminar "${product.name}"?`)) {
                          handleDelete(product.id);
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

      {/* Modal para crear/editar producto (Mismo que antes) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* ... Header Modal ... */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {editingProduct ? "Editar Producto" : "Nuevo Producto"}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ProductForm
              product={editingProduct}
              categories={categories}
              suppliers={suppliers}
              onSave={handleSave}
              onCancel={() => setIsModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Formulario simple para productos
function ProductForm({
  product,
  categories,
  suppliers,
  onSave,
  onCancel
}: {
  product: SimpleProduct | null;
  categories: any[];
  suppliers: any[];
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    sku: product?.sku || product?.barcode || "",
    price: product?.price || 0,
    cost: product?.cost || 0,
    min_stock: product?.min_stock || 0,
    unit: product?.unit || "EA",
    barcode: product?.barcode || "",
    category_id: product?.category?.id || "",
    supplier_id: (product as any)?.supplier_id || "",
    is_active: product?.is_active ?? true,
  });

  const [showScanner, setShowScanner] = useState(false);

  // Mantener el SKU sincronizado con el código de barras
  useEffect(() => {
    setFormData(prev => ({ ...prev, sku: formData.barcode }));
  }, [formData.barcode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const barcodeValue = e.target.value;
    setFormData({ ...formData, barcode: barcodeValue });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nombre *</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Categoría</label>
          {categories.length > 0 ? (
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              placeholder="No hay categorías disponibles"
              disabled
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Proveedor</label>
          {suppliers.length > 0 ? (
            <select
              value={formData.supplier_id}
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="">Sin proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={formData.supplier_id}
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              placeholder="No hay proveedores disponibles"
              disabled
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Precio de Venta *</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            required
          />
          <div className="text-xs text-muted-foreground mt-1">
            Precio al que vendes el producto
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Costo del Producto *</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.cost}
            onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            required
          />
          <div className="text-xs text-muted-foreground mt-1">
            Lo que te cuesta el producto
          </div>
        </div>
      </div>

      {/* Mostrar margen de ganancia */}
      {formData.price > 0 && formData.cost > 0 && (
        <div className="bg-muted/50 p-3 rounded-lg">
          <div className="text-sm font-medium">
            Margen de Ganancia:
            <span className={`ml-2 ${((formData.price - formData.cost) / formData.cost * 100) > 50 ? 'text-green-600' :
              ((formData.price - formData.cost) / formData.cost * 100) > 20 ? 'text-yellow-600' : 'text-red-600'
              }`}>
              {((formData.price - formData.cost) / formData.cost * 100).toFixed(1)}%
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Ganancia por unidad: ${(formData.price - formData.cost).toFixed(2)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Stock Mínimo</label>
          <Input
            type="number"
            min="0"
            value={formData.min_stock}
            onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
            placeholder="Cantidad mínima en stock"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Unidad</label>
          <select
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md bg-background"
          >
            <option value="PZ">PZ - Pieza</option>
            <option value="KG">KG - Kilogramo</option>
            <option value="LT">LT - Litro</option>
            <option value="MT">MT - Metro</option>
            <option value="EA">EA - Each (Cada uno)</option>
            <option value="PAQ">PAQ - Paquete</option>
            <option value="CAJ">CAJ - Caja</option>
            <option value="BOL">BOL - Bolsa</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Descripción</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descripción detallada del producto"
          className="w-full px-3 py-2 border border-input rounded-md bg-background min-h-[80px] resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Código de Barras</label>
        <div className="flex gap-2">
          <Input
            value={formData.barcode}
            onChange={handleBarcodeChange}
            placeholder="Código de barras del producto"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowScanner(true)}
            className="px-3"
          >
            <Scan className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          El SKU se genera automáticamente del código de barras
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          SKU *
          <span className="text-xs text-muted-foreground ml-2">(Se genera automáticamente del código de barras)</span>
        </label>
        <Input
          value={formData.sku}
          disabled={true}
          required
          className="bg-muted"
          placeholder="Se genera automáticamente..."
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
        />
        <label htmlFor="is_active" className="text-sm font-medium">Producto activo</label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {product ? "Actualizar" : "Crear"}
        </Button>
      </div>

      {/* Escáner de código de barras */}
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => {
            setFormData({ ...formData, barcode: code });
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </form>
  );
}

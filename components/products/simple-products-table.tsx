"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Package, DollarSign, AlertTriangle, X, Scan } from "lucide-react";
import type { SimpleProduct } from "@/lib/types/inventory";
import { BarcodeScanner } from "@/components/barcode-scanner";

export function SimpleProductsTable() {
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SimpleProduct | null>(null);
  const { success, error: showError } = useToast();

  const fetchProducts = async () => {
    const supabase = createClient();
    try {
      // Obtener productos con categorías
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(id, name)
        `)
        .order("created_at", { ascending: false });

      if (productsError) throw productsError;

      // Obtener stock por almacén para todos los productos
      const { data: stockData, error: stockError } = await supabase
        .from("stock")
        .select(`
          product_id,
          warehouse_id,
          qty,
          warehouse:warehouses(id, name, code)
        `);

      if (stockError) {
        console.warn("No se pudo obtener información de stock:", stockError);
      }

      // Obtener categorías para el formulario
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");

      if (!categoriesError && categoriesData) {
        setCategories(categoriesData);
      }

      // Obtener proveedores para el formulario
      const { data: suppliersData, error: suppliersError } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (!suppliersError && suppliersData) {
        setSuppliers(suppliersData);
      }

      // Combinar datos y calcular información
      const enrichedProducts = (productsData || []).map(product => {
        // Calcular stock por almacén
        const productStock = stockData?.filter(s => s.product_id === product.id) || [];
        const totalStock = productStock.reduce((sum, s) => sum + (s.qty || 0), 0);
        
        // Calcular información financiera
        const inventoryValue = totalStock * product.price;
        const profitMargin = product.cost > 0 ? ((product.price - product.cost) / product.cost) * 100 : 0;
        
        // Determinar estado del stock
        let stockStatus: 'critical' | 'low' | 'normal' | 'high' = 'normal';
        if (totalStock === 0) stockStatus = 'critical';
        else if (totalStock <= product.min_stock) stockStatus = 'low';
        else if (totalStock > product.min_stock * 3) stockStatus = 'high';

        return {
          ...product,
          totalStock,
          stockByWarehouse: productStock,
          inventoryValue,
          profitMargin,
          stockStatus
        };
      });

      setProducts(enrichedProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
      showError("Error", "No se pudieron cargar los productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Funciones para manejar productos
  const handleEdit = (product: SimpleProduct) => {
    setEditingProduct(product);
    setIsModalOpen(true);
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
      fetchProducts(); // Recargar la lista
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
      fetchProducts(); // Recargar la lista
    } catch (error) {
      console.error("Error saving product:", error);
      showError("Error", "No se pudo guardar el producto");
    }
  };

  const handleNew = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const filteredProducts = products.filter(product => {
    // Filtro de búsqueda
    const matchesSearch = search === "" || 
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(search.toLowerCase()));

    // Filtro de categoría
    const matchesCategory = categoryFilter === "" || 
      (categoryFilter === "sin-categoria" && !product.category) ||
      (product.category && product.category.id === categoryFilter);

    // Filtro de stock
    const matchesStock = stockFilter === "" ||
      (stockFilter === "sin-stock" && (product.totalStock || 0) === 0) ||
      (stockFilter === "stock-bajo" && product.stockStatus === 'low') ||
      (stockFilter === "stock-critico" && product.stockStatus === 'critical') ||
      (stockFilter === "stock-normal" && product.stockStatus === 'normal') ||
      (stockFilter === "stock-alto" && product.stockStatus === 'high');

    // Filtro de estado
    const matchesStatus = statusFilter === "" ||
      (statusFilter === "activo" && product.is_active) ||
      (statusFilter === "inactivo" && !product.is_active);

    return matchesSearch && matchesCategory && matchesStock && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalValue = products.reduce((sum, p) => sum + (p.inventoryValue || 0), 0);
  const activeProducts = products.filter(p => p.is_active).length;
  const lowStockProducts = products.filter(p => p.stockStatus === 'low' || p.stockStatus === 'critical').length;
  const criticalStockProducts = products.filter(p => p.stockStatus === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-foreground">{products.length}</div>
              <div className="text-sm text-muted-foreground">Total Productos</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-600">{activeProducts}</div>
              <div className="text-sm text-muted-foreground">Productos Activos</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <div>
              <div className="text-2xl font-bold text-orange-600">{lowStockProducts}</div>
              <div className="text-sm text-muted-foreground">
                Stock Bajo ({criticalStockProducts} críticos)
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-purple-600" />
            <div>
              <div className="text-2xl font-bold text-purple-600">${totalValue.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Valor Real Inventario</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controles */}
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
            <Button onClick={fetchProducts} variant="outline">
              Actualizar
            </Button>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </div>

        {/* Filtros Avanzados */}
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

        {/* Indicador de filtros activos */}
        {(search || categoryFilter || stockFilter || statusFilter) && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Filtros activos:</span>
            {search && (
              <Badge variant="secondary" className="text-xs">
                Búsqueda: "{search}"
                <button 
                  onClick={() => setSearch("")}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {categoryFilter && (
              <Badge variant="secondary" className="text-xs">
                Categoría: {categoryFilter === "sin-categoria" ? "Sin categoría" : 
                  categories.find(c => c.id === categoryFilter)?.name || categoryFilter}
                <button 
                  onClick={() => setCategoryFilter("")}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {stockFilter && (
              <Badge variant="secondary" className="text-xs">
                Stock: {stockFilter.replace("stock-", "").replace("-", " ")}
                <button 
                  onClick={() => setStockFilter("")}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {statusFilter && (
              <Badge variant="secondary" className="text-xs">
                Estado: {statusFilter}
                <button 
                  onClick={() => setStatusFilter("")}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Tabla mejorada */}
      <div className="border rounded-lg overflow-hidden bg-card">
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
            {filteredProducts.map((product) => (
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
                  {product.category?.name ? (
                    <Badge variant="secondary">
                      {product.category.name}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Sin categoría</span>
                  )}
                </td>
                
                <td className="p-4 text-right">
                  <div className="font-medium text-lg">
                    {product.totalStock || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Mín: {product.min_stock} {product.unit}
                  </div>
                  {product.stockByWarehouse && product.stockByWarehouse.length > 0 && (
                    <div className="text-xs text-blue-600">
                      {product.stockByWarehouse.length} almacén(es)
                    </div>
                  )}
                </td>
                
                <td className="p-4 text-right">
                  <div className="font-medium">${product.price.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">
                    Valor: ${(product.inventoryValue || 0).toFixed(2)}
                  </div>
                  <div className={`text-xs ${(product.profitMargin || 0) > 50 ? 'text-green-600' : (product.profitMargin || 0) > 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                    Margen: {(product.profitMargin || 0).toFixed(1)}%
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
                          product.stockStatus === 'critical' ? "destructive" :
                          product.stockStatus === 'low' ? "secondary" :
                          product.stockStatus === 'high' ? "default" : "outline"
                        }
                        className="text-xs"
                      >
                        {product.stockStatus === 'critical' ? '🔴 Sin Stock' :
                         product.stockStatus === 'low' ? '🟡 Stock Bajo' :
                         product.stockStatus === 'high' ? '🟢 Stock Alto' : '✅ Normal'}
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

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-lg font-medium text-muted-foreground mb-2">
              {products.length === 0 
                ? "No hay productos registrados" 
                : "No se encontraron productos"
              }
            </div>
            <div className="text-sm text-muted-foreground">
              {products.length === 0 
                ? "Comienza agregando tu primer producto" 
                : "Intenta con otros términos de búsqueda"
              }
            </div>
          </div>
        )}
      </div>

      {/* Footer con información */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <div>
          Mostrando {filteredProducts.length} de {products.length} productos
        </div>
        <div>
          Última actualización: {new Date().toLocaleTimeString()}
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
    sku: product?.sku || "",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nombre *</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">SKU *</label>
        <Input
          value={formData.sku}
          onChange={(e) => setFormData({...formData, sku: e.target.value})}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Categoría</label>
          {categories.length > 0 ? (
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({...formData, category_id: e.target.value})}
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
              onChange={(e) => setFormData({...formData, category_id: e.target.value})}
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
              onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
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
              onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
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
            onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
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
            onChange={(e) => setFormData({...formData, cost: parseFloat(e.target.value) || 0})}
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
            <span className={`ml-2 ${
              ((formData.price - formData.cost) / formData.cost * 100) > 50 ? 'text-green-600' : 
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
            onChange={(e) => setFormData({...formData, min_stock: parseInt(e.target.value) || 0})}
            placeholder="Cantidad mínima en stock"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Unidad</label>
          <select
            value={formData.unit}
            onChange={(e) => setFormData({...formData, unit: e.target.value})}
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
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          placeholder="Descripción detallada del producto"
          className="w-full px-3 py-2 border border-input rounded-md bg-background min-h-[80px] resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Código de Barras</label>
        <div className="flex gap-2">
          <Input
            value={formData.barcode}
            onChange={(e) => setFormData({...formData, barcode: e.target.value})}
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
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
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
            setFormData({...formData, barcode: code});
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </form>
  );
}

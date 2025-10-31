"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Tag, Package, TrendingUp, X } from "lucide-react";
import type { Category } from "@/lib/types/inventory";

interface EnrichedCategory extends Category {
  productCount?: number;
  totalValue?: number;
  averagePrice?: number;
  isPopular?: boolean;
}

export function SimpleCategoriesTable() {
  const [categories, setCategories] = useState<EnrichedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EnrichedCategory | null>(null);
  const { success, error: showError } = useToast();

  const fetchCategories = async () => {
    const supabase = createClient();
    try {
      // Obtener categorías con información de productos
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .order("created_at", { ascending: false });

      if (categoriesError) throw categoriesError;

      // Obtener productos para calcular estadísticas por categoría
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("category_id, price, is_active");

      if (productsError) {
        console.warn("No se pudo obtener información de productos:", productsError);
      }

      // Enriquecer categorías con estadísticas
      const enrichedCategories = (categoriesData || []).map(category => {
        const categoryProducts = productsData?.filter(p => p.category_id === category.id && p.is_active) || [];
        const productCount = categoryProducts.length;
        const totalValue = categoryProducts.reduce((sum, p) => sum + (p.price || 0), 0);
        const averagePrice = productCount > 0 ? totalValue / productCount : 0;
        const isPopular = productCount >= 3; // Categoría popular si tiene 3+ productos

        return {
          ...category,
          productCount,
          totalValue,
          averagePrice,
          isPopular
        };
      });

      setCategories(enrichedCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      showError("Error", "No se pudieron cargar las categorías");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Funciones para manejar categorías
  const handleEdit = (category: EnrichedCategory) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const handleDelete = async (categoryId: string) => {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;
      
      success("Categoría eliminada", "La categoría se eliminó correctamente");
      fetchCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      showError("Error", "No se pudo eliminar la categoría");
    }
  };

  const handleSave = async (categoryData: any) => {
    const supabase = createClient();
    try {
      if (editingCategory) {
        // Actualizar categoría existente
        const { error } = await supabase
          .from("categories")
          .update(categoryData)
          .eq("id", editingCategory.id);

        if (error) throw error;
        success("Categoría actualizada", "La categoría se actualizó correctamente");
      } else {
        // Crear nueva categoría
        const { error } = await supabase
          .from("categories")
          .insert([categoryData]);

        if (error) throw error;
        success("Categoría creada", "La categoría se creó correctamente");
      }
      
      setIsModalOpen(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (error) {
      console.error("Error saving category:", error);
      showError("Error", "No se pudo guardar la categoría");
    }
  };

  const handleNew = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(search.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalCategories = categories.length;
  const activeCategories = categories.filter(c => c.productCount && c.productCount > 0).length;
  const popularCategories = categories.filter(c => c.isPopular).length;
  const totalProducts = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Tag className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-foreground">{totalCategories}</div>
              <div className="text-sm text-muted-foreground">Total Categorías</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-600">{activeCategories}</div>
              <div className="text-sm text-muted-foreground">Con Productos</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            <div>
              <div className="text-2xl font-bold text-orange-600">{popularCategories}</div>
              <div className="text-sm text-muted-foreground">Populares (3+ productos)</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-purple-600" />
            <div>
              <div className="text-2xl font-bold text-purple-600">{totalProducts}</div>
              <div className="text-sm text-muted-foreground">Total Productos</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar categorías..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Button onClick={fetchCategories} variant="outline">
            Actualizar
          </Button>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Categoría
          </Button>
        </div>
      </div>

      {/* Tabla mejorada */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Categoría</th>
              <th className="text-center p-4 font-medium">Productos</th>
              <th className="text-right p-4 font-medium">Precio Promedio</th>
              <th className="text-center p-4 font-medium">Estado</th>
              <th className="text-center p-4 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredCategories.map((category) => (
              <tr key={category.id} className="border-t hover:bg-muted/25 transition-colors">
                <td className="p-4">
                  <div>
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      {category.name}
                    </div>
                    {category.description && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {category.description}
                      </div>
                    )}
                  </div>
                </td>
                
                <td className="p-4 text-center">
                  <div className="font-medium text-lg">
                    {category.productCount || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    productos
                  </div>
                </td>
                
                <td className="p-4 text-right">
                  <div className="font-medium">
                    ${(category.averagePrice || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    promedio
                  </div>
                </td>
                
                <td className="p-4 text-center">
                  <div className="space-y-1">
                    <Badge variant={category.productCount && category.productCount > 0 ? "default" : "secondary"}>
                      {category.productCount && category.productCount > 0 ? "Activa" : "Vacía"}
                    </Badge>
                    {category.isPopular && (
                      <Badge variant="outline" className="text-xs">
                        🔥 Popular
                      </Badge>
                    )}
                  </div>
                </td>
                
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(category)}
                    >
                      Editar
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        if (confirm(`¿Estás seguro de eliminar "${category.name}"?`)) {
                          handleDelete(category.id);
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

        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-lg font-medium text-muted-foreground mb-2">
              {categories.length === 0 
                ? "No hay categorías registradas" 
                : "No se encontraron categorías"
              }
            </div>
            <div className="text-sm text-muted-foreground">
              {categories.length === 0 
                ? "Comienza creando tu primera categoría" 
                : "Intenta con otros términos de búsqueda"
              }
            </div>
          </div>
        )}
      </div>

      {/* Footer con información */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <div>
          Mostrando {filteredCategories.length} de {categories.length} categorías
        </div>
        <div>
          Última actualización: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Modal para crear/editar categoría */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <CategoryForm
              category={editingCategory}
              onSave={handleSave}
              onCancel={() => setIsModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Formulario simple para categorías
function CategoryForm({ 
  category, 
  onSave, 
  onCancel 
}: { 
  category: EnrichedCategory | null;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: category?.name || "",
    description: category?.description || "",
  });

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
          placeholder="Ej: Bebidas, Alimentos, etc."
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Descripción</label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          placeholder="Descripción de la categoría"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {category ? "Actualizar" : "Crear"}
        </Button>
      </div>
    </form>
  );
}

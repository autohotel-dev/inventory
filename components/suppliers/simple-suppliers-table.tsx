"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Building2, Package, Mail, Phone, X } from "lucide-react";
import type { Supplier } from "@/lib/types/inventory";

interface EnrichedSupplier extends Supplier {
  productCount?: number;
  totalValue?: number;
  averagePrice?: number;
  isPreferred?: boolean;
}

export function SimpleSuppliersTable() {
  const [suppliers, setSuppliers] = useState<EnrichedSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<EnrichedSupplier | null>(null);
  const { success, error: showError } = useToast();

  const fetchSuppliers = async () => {
    const supabase = createClient();
    try {
      // Obtener proveedores
      const { data: suppliersData, error: suppliersError } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });

      if (suppliersError) throw suppliersError;

      // Obtener productos para calcular estadísticas por proveedor
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("supplier_id, price, is_active")
        .not("supplier_id", "is", null);

      if (productsError) {
        console.warn("No se pudo obtener información de productos:", productsError);
      }

      // Enriquecer proveedores con estadísticas
      const enrichedSuppliers = (suppliersData || []).map(supplier => {
        const supplierProducts = productsData?.filter(p => p.supplier_id === supplier.id && p.is_active) || [];
        const productCount = supplierProducts.length;
        const totalValue = supplierProducts.reduce((sum, p) => sum + (p.price || 0), 0);
        const averagePrice = productCount > 0 ? totalValue / productCount : 0;
        const isPreferred = productCount >= 5; // Proveedor preferido si tiene 5+ productos

        return {
          ...supplier,
          productCount,
          totalValue,
          averagePrice,
          isPreferred
        };
      });

      setSuppliers(enrichedSuppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      showError("Error", "No se pudieron cargar los proveedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Funciones para manejar proveedores
  const handleEdit = (supplier: EnrichedSupplier) => {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleDelete = async (supplierId: string) => {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierId);

      if (error) throw error;
      
      success("Proveedor eliminado", "El proveedor se eliminó correctamente");
      fetchSuppliers();
    } catch (error) {
      console.error("Error deleting supplier:", error);
      showError("Error", "No se pudo eliminar el proveedor");
    }
  };

  const handleSave = async (supplierData: any) => {
    const supabase = createClient();
    try {
      if (editingSupplier) {
        // Actualizar proveedor existente
        const { error } = await supabase
          .from("suppliers")
          .update(supplierData)
          .eq("id", editingSupplier.id);

        if (error) throw error;
        success("Proveedor actualizado", "El proveedor se actualizó correctamente");
      } else {
        // Crear nuevo proveedor
        const { error } = await supabase
          .from("suppliers")
          .insert([supplierData]);

        if (error) throw error;
        success("Proveedor creado", "El proveedor se creó correctamente");
      }
      
      setIsModalOpen(false);
      setEditingSupplier(null);
      fetchSuppliers();
    } catch (error) {
      console.error("Error saving supplier:", error);
      showError("Error", "No se pudo guardar el proveedor");
    }
  };

  const handleNew = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(search.toLowerCase()) ||
    (supplier.email && supplier.email.toLowerCase().includes(search.toLowerCase())) ||
    (supplier.phone && supplier.phone.includes(search))
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter(s => s.is_active).length;
  const preferredSuppliers = suppliers.filter(s => s.isPreferred).length;
  const totalProducts = suppliers.reduce((sum, s) => sum + (s.productCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-foreground">{totalSuppliers}</div>
              <div className="text-sm text-muted-foreground">Total Proveedores</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-600">{activeSuppliers}</div>
              <div className="text-sm text-muted-foreground">Activos</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-orange-600" />
            <div>
              <div className="text-2xl font-bold text-orange-600">{preferredSuppliers}</div>
              <div className="text-sm text-muted-foreground">Preferidos (5+ productos)</div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-purple-600" />
            <div>
              <div className="text-2xl font-bold text-purple-600">{totalProducts}</div>
              <div className="text-sm text-muted-foreground">Productos Suministrados</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar proveedores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Button onClick={fetchSuppliers} variant="outline">
            Actualizar
          </Button>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Proveedor
          </Button>
        </div>
      </div>

      {/* Tabla mejorada */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Proveedor</th>
              <th className="text-left p-4 font-medium">Contacto</th>
              <th className="text-center p-4 font-medium">Productos</th>
              <th className="text-center p-4 font-medium">Estado</th>
              <th className="text-center p-4 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.map((supplier) => (
              <tr key={supplier.id} className="border-t hover:bg-muted/25 transition-colors">
                <td className="p-4">
                  <div>
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {supplier.name}
                    </div>
                    {supplier.address && (
                      <div className="text-sm text-muted-foreground mt-1">
                        📍 {supplier.address}
                      </div>
                    )}
                  </div>
                </td>
                
                <td className="p-4">
                  <div className="space-y-1">
                    {supplier.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">
                          {supplier.email}
                        </a>
                      </div>
                    )}
                    {supplier.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <a href={`tel:${supplier.phone}`} className="text-blue-600 hover:underline">
                          {supplier.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </td>
                
                <td className="p-4 text-center">
                  <div className="font-medium text-lg">
                    {supplier.productCount || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    productos
                  </div>
                </td>
                
                <td className="p-4 text-center">
                  <div className="space-y-1">
                    <Badge variant={supplier.is_active ? "default" : "secondary"}>
                      {supplier.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                    {supplier.isPreferred && (
                      <Badge variant="outline" className="text-xs">
                        ⭐ Preferido
                      </Badge>
                    )}
                  </div>
                </td>
                
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(supplier)}
                    >
                      Editar
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        if (confirm(`¿Estás seguro de eliminar "${supplier.name}"?`)) {
                          handleDelete(supplier.id);
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

        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-lg font-medium text-muted-foreground mb-2">
              {suppliers.length === 0 
                ? "No hay proveedores registrados" 
                : "No se encontraron proveedores"
              }
            </div>
            <div className="text-sm text-muted-foreground">
              {suppliers.length === 0 
                ? "Comienza agregando tu primer proveedor" 
                : "Intenta con otros términos de búsqueda"
              }
            </div>
          </div>
        )}
      </div>

      {/* Footer con información */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <div>
          Mostrando {filteredSuppliers.length} de {suppliers.length} proveedores
        </div>
        <div>
          Última actualización: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Modal para crear/editar proveedor */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {editingSupplier ? "Editar Proveedor" : "Nuevo Proveedor"}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <SupplierForm
              supplier={editingSupplier}
              onSave={handleSave}
              onCancel={() => setIsModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Formulario simple para proveedores
function SupplierForm({ 
  supplier, 
  onSave, 
  onCancel 
}: { 
  supplier: EnrichedSupplier | null;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: supplier?.name || "",
    email: supplier?.email || "",
    phone: supplier?.phone || "",
    address: supplier?.address || "",
    is_active: supplier?.is_active ?? true,
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
          placeholder="Ej: Distribuidora ABC"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          placeholder="contacto@proveedor.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Teléfono</label>
        <Input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
          placeholder="+52 555 123 4567"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Dirección</label>
        <textarea
          value={formData.address}
          onChange={(e) => setFormData({...formData, address: e.target.value})}
          placeholder="Dirección completa del proveedor"
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
        <label htmlFor="is_active" className="text-sm font-medium">Proveedor activo</label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {supplier ? "Actualizar" : "Crear"}
        </Button>
      </div>
    </form>
  );
}

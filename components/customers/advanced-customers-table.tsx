"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  Users, 
  Mail, 
  Phone, 
  MapPin,
  TrendingUp,
  DollarSign,
  Calendar,
  X,
  Building,
  RefreshCw
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  // Estadísticas calculadas
  total_orders?: number;
  total_spent?: number;
  last_order?: string | null;
  customer_type?: 'new' | 'regular' | 'vip';
  // Campos adicionales de la vista
  customer_name?: string;
  customer_email?: string;
}

export function AdvancedCustomersTable() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { success, error: showError } = useToast();

  const fetchCustomers = async () => {
    const supabase = createClient();
    try {
      // Opción 1: Usar la vista (más simple y confiable)
      const { data: customersWithStats, error } = await supabase
        .from("customer_statistics_view")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error con vista, intentando procedimiento almacenado:", error);

        // Opción 2: Fallback al procedimiento almacenado si la vista falla
        const { data: customersData, error: customersError } = await supabase
          .from("customers")
          .select("*")
          .order("created_at", { ascending: false });

        if (customersError) throw customersError;

        const { data: statsData, error: statsError } = await supabase
          .rpc("get_customer_statistics");

        if (statsError) throw statsError;

        // Combinar datos
        const enrichedCustomers: Customer[] = (customersData || []).map(customer => {
          const stats = statsData?.find((s: any) => s.customer_id === customer.id);

          return {
            ...customer,
            total_orders: stats?.total_orders || 0,
            total_spent: Number(stats?.total_spent) || 0,
            last_order: stats?.last_order_date || null,
            customer_type: (stats?.customer_type as 'new' | 'regular' | 'vip') || 'new'
          };
        });

        setCustomers(enrichedCustomers);
        return;
      }

      // Usar datos de la vista directamente
      const enrichedCustomers: Customer[] = (customersWithStats || []).map(customer => ({
        id: customer.customer_id,
        name: customer.customer_name,
        email: customer.customer_email,
        tax_id: "", // Estos campos no están en la vista, se pueden agregar después
        phone: "",
        address: "",
        is_active: true,
        created_at: new Date().toISOString(), // Fecha por defecto
        total_orders: customer.total_orders || 0,
        total_spent: Number(customer.total_spent) || 0,
        last_order: customer.last_order_date || null,
        customer_type: (customer.customer_type as 'new' | 'regular' | 'vip') || 'new'
      }));

      setCustomers(enrichedCustomers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      showError("Error", error instanceof Error ? error.message : "No se pudieron cargar los clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDelete = async (customerId: string) => {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId);

      if (error) throw error;
      
      success("Cliente eliminado", "El cliente se eliminó correctamente");
      fetchCustomers();
    } catch (error) {
      console.error("Error deleting customer:", error);
      showError("Error", "No se pudo eliminar el cliente");
    }
  };

  const handleSave = async (customerData: any) => {
    const supabase = createClient();
    try {
      if (editingCustomer) {
        // Actualizar cliente existente
        const { error } = await supabase
          .from("customers")
          .update(customerData)
          .eq("id", editingCustomer.id);

        if (error) throw error;
        success("Cliente actualizado", "El cliente se actualizó correctamente");
      } else {
        // Crear nuevo cliente
        const { error } = await supabase
          .from("customers")
          .insert([customerData]);

        if (error) throw error;
        success("Cliente creado", "El cliente se creó correctamente");
      }
      
      setIsModalOpen(false);
      setEditingCustomer(null);
      fetchCustomers();
    } catch (error) {
      console.error("Error saving customer:", error);
      showError("Error", "No se pudo guardar el cliente");
    }
  };

  const handleNew = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const filteredCustomers = customers.filter(customer => {
    // Usar nombre real del cliente (de la vista o del campo name)
    const customerName = customer.customer_name || customer.name || "";
    const customerEmail = customer.customer_email || customer.email || "";

    const matchesSearch = search === "" ||
      customerName.toLowerCase().includes(search.toLowerCase()) ||
      customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      (customer.phone && customer.phone.includes(search)) ||
      (customer.tax_id && customer.tax_id.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "" ||
      (statusFilter === "active" && customer.is_active) ||
      (statusFilter === "inactive" && !customer.is_active);

    const matchesType = typeFilter === "" || customer.customer_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.is_active).length;
  const vipCustomers = customers.filter(c => c.customer_type === 'vip').length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              Registrados en el sistema
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {((activeCustomers / totalCustomers) * 100).toFixed(1)}% del total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes VIP</CardTitle>
            <Building className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{vipCustomers}</div>
            <p className="text-xs text-muted-foreground">
              Alto valor de compra
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Ventas acumuladas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Button onClick={fetchCustomers} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Cliente
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
          <div>
            <label className="block text-sm font-medium mb-2">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="">Todos los estados</option>
              <option value="active">✅ Activos</option>
              <option value="inactive">❌ Inactivos</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tipo de Cliente</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="">Todos los tipos</option>
              <option value="new">🆕 Nuevos</option>
              <option value="regular">👤 Regulares</option>
              <option value="vip">⭐ VIP</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button 
              variant="outline" 
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setTypeFilter("");
              }}
              className="w-full"
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </div>

      {/* Tabla mejorada */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Cliente</th>
              <th className="text-left p-4 font-medium">Contacto</th>
              <th className="text-center p-4 font-medium">Estadísticas</th>
              <th className="text-center p-4 font-medium">Tipo</th>
              <th className="text-center p-4 font-medium">Estado</th>
              <th className="text-center p-4 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((customer) => (
              <tr key={customer.id} className="border-t hover:bg-muted/25 transition-colors">
                <td className="p-4">
                  <div>
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {customer.customer_name || customer.name}
                    </div>
                    {customer.tax_id && (
                      <div className="text-sm text-muted-foreground">
                        RFC/ID: {customer.tax_id}
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        {customer.address}
                      </div>
                    )}
                  </div>
                </td>
                
                <td className="p-4">
                  <div className="space-y-1">
                    {(customer.customer_email || customer.email) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <a href={`mailto:${customer.customer_email || customer.email}`} className="text-blue-600 hover:underline">
                          {customer.customer_email || customer.email}
                        </a>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">
                          {customer.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </td>
                
                <td className="p-4 text-center">
                  <div className="space-y-1">
                    <div className="font-medium">{customer.total_orders || 0} pedidos</div>
                    <div className="text-sm text-green-600 font-medium">
                      ${(customer.total_spent || 0).toFixed(2)}
                    </div>
                    {customer.last_order && (
                      <div className="text-xs text-muted-foreground">
                        Último: {new Date(customer.last_order).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </td>
                
                <td className="p-4 text-center">
                  <Badge 
                    variant={
                      customer.customer_type === 'vip' ? 'default' :
                      customer.customer_type === 'regular' ? 'secondary' : 'outline'
                    }
                  >
                    {customer.customer_type === 'vip' && '⭐ VIP'}
                    {customer.customer_type === 'regular' && '👤 Regular'}
                    {customer.customer_type === 'new' && '🆕 Nuevo'}
                  </Badge>
                </td>
                
                <td className="p-4 text-center">
                  <Badge variant={customer.is_active ? "default" : "secondary"}>
                    {customer.is_active ? "✅ Activo" : "❌ Inactivo"}
                  </Badge>
                </td>
                
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(customer)}
                    >
                      Editar
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        if (confirm(`¿Estás seguro de eliminar "${customer.customer_name || customer.name}"?`)) {
                          handleDelete(customer.id);
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

        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-lg font-medium text-muted-foreground mb-2">
              {customers.length === 0 
                ? "No hay clientes registrados" 
                : "No se encontraron clientes"
              }
            </div>
            <div className="text-sm text-muted-foreground">
              {customers.length === 0 
                ? "Comienza agregando tu primer cliente" 
                : "Intenta con otros términos de búsqueda"
              }
            </div>
          </div>
        )}
      </div>

      {/* Footer con información */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <div>
          Mostrando {filteredCustomers.length} de {customers.length} clientes
        </div>
        <div>
          Última actualización: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Modal para crear/editar cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <CustomerForm
              customer={editingCustomer}
              onSave={handleSave}
              onCancel={() => setIsModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Formulario simple para clientes
function CustomerForm({ 
  customer, 
  onSave, 
  onCancel 
}: { 
  customer: Customer | null;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: customer?.name || "",
    tax_id: customer?.tax_id || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    address: customer?.address || "",
    is_active: customer?.is_active ?? true,
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
          placeholder="Ej: Juan Pérez"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">RFC/ID Fiscal</label>
        <Input
          value={formData.tax_id}
          onChange={(e) => setFormData({...formData, tax_id: e.target.value})}
          placeholder="RFC o identificación fiscal"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          placeholder="cliente@email.com"
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
          placeholder="Dirección completa del cliente"
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
        <label htmlFor="is_active" className="text-sm font-medium">Cliente activo</label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {customer ? "Actualizar" : "Crear"}
        </Button>
      </div>
    </form>
  );
}

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
    RefreshCw,
    Archive,
    CheckCircle,
    Check
} from "lucide-react";
import { Customer, CustomerSales } from "@/lib/types/inventory";
import { getCustomer, getCustomerSales } from "@/lib/functions/customer";

interface Props {
    params: Promise<{ id: string }>;
}


export function AdvancedCustomersSalesTable({ params }: Props) {
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [customerSales, setCustomerSales] = useState<CustomerSales[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [warehouseFilter, setWarehouseFilter] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const { success, error: showError } = useToast();

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            console.log("ID del cliente en el useEffect: ", (await params).id);
            const customer = await getCustomer((await params).id);
            setCustomer(customer);
            if (customer) {
                const customerSales = await getCustomerSales(customer.id);
                setCustomerSales(customerSales);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching customers:', error);
            setLoading(false);
        }
    };

    const filteredCustomerSales = customerSales.filter(customerSale => {
        // Usar nombre real del cliente (de la vista o del campo name)
        const customerSaleOrderNumber = customerSale.order_number || "";
        const customerSaleStatus = customerSale.status || "";

        const matchesSearch = search === "" ||
            customerSaleOrderNumber.toLowerCase().includes(search.toLowerCase()) ||
            customerSaleStatus.toLowerCase().includes(search.toLowerCase());

        const matchesStatus = statusFilter === "" ||
            (statusFilter === "COMPLETED" && customerSale.status === "COMPLETED") ||
            (statusFilter === "PENDING" && customerSale.status === "PENDING");

        const matchesWarehouse = warehouseFilter === "" || customerSale.warehouse_id === warehouseFilter;

        return matchesSearch && matchesStatus && matchesWarehouse;
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const totalCustomerSales = customerSales.length;
    const completedCustomerSales = customerSales.filter(c => c.status === 'COMPLETED').length;
    const pendingCustomerSales = customerSales.filter(c => c.status === 'PENDING').length;
    const totalRevenue = customerSales.reduce((sum, c) => sum + (c.total || 0), 0);

    return (
        <div className="space-y-6">
            {/* Header con estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCustomerSales}</div>
                        <p className="text-xs text-muted-foreground">
                            Total de ventas
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completados</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{completedCustomerSales}</div>
                        <p className="text-xs text-muted-foreground">
                            {((completedCustomerSales / totalCustomerSales) * 100).toFixed(1)}% del total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                        <Building className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">{pendingCustomerSales}</div>
                        <p className="text-xs text-muted-foreground">
                            Pendientes de pago
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
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
                        <Button onClick={() => fetchCustomers()} variant="outline">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Actualizar
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
                            <option value="COMPLETED">✅ Abiertas</option>
                            <option value="PENDING">❌ Cerradas</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Almacen</label>
                        <select
                            value={warehouseFilter}
                            onChange={(e) => setWarehouseFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                        >
                            <option value="">Todos los almacenes</option>
                            <option value="warehouse1">Almacén 1</option>
                            <option value="warehouse2">Almacén 2</option>
                        </select>
                    </div>

                    <div className="flex items-end">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSearch("");
                                setStatusFilter("");
                                setWarehouseFilter("");
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
                            <th className="text-left p-4 font-medium">Resumen</th>
                            <th className="text-center p-4 font-medium">Abonado / Restante</th>
                            <th className="text-center p-4 font-medium">Detalles</th>
                            <th className="text-center p-4 font-medium">Fecha de creación</th>
                            <th className="text-center p-4 font-medium">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCustomerSales.map((customerSale) => (
                            <tr key={customerSale.id} className="border-t hover:bg-muted/25 transition-colors">
                                <td className="p-4">
                                    <div>
                                        <div className="font-medium text-foreground flex items-center gap-2">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            {customerSale.order_number || customerSale.id}
                                        </div>
                                        {customerSale.customer_id && (
                                            <div className="text-sm text-muted-foreground">
                                                <div className="truncate max-w-[200px]" title={customerSale.customer_id}>
                                                    Cliente: {customerSale.customer_id}
                                                </div>
                                            </div>
                                        )}
                                        {customerSale.status && (
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                                <Badge variant="outline" className="bg-green-500/50 text-muted-foreground">
                                                    {customerSale.status === "COMPLETED" ? "Completada" : "Pendiente"}
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                </td>

                                <td className="p-4">
                                    <div className="space-y-1">
                                        {(customerSale.total || customerSale.subtotal) && (
                                            <div className="flex items-center justify-center gap-2 text-sm">
                                                ${(customerSale.subtotal || customerSale.tax).toFixed(2)}
                                            </div>
                                        )}
                                        {customerSale.total && (
                                            <div className="flex items-center justify-center gap-2 text-sm">
                                                <Badge variant="outline" className="bg-yellow-500/50 text-muted-foreground">
                                                    Restante: ${(customerSale.total - customerSale.discount || 0).toFixed(2)}
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                </td>

                                <td className="p-4 text-center">
                                    <div className="space-y-1">
                                        <div className="font-medium">{customerSale.notes}</div>
                                        <div className="text-sm text-green-600 font-medium">
                                            ${(customerSale.total || 0).toFixed(2)}
                                        </div>
                                        {customerSale.created_at && (
                                            <div className="text-xs text-muted-foreground">
                                                Último abono: {new Date(customerSale.created_at).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                </td>

                                <td className="p-4 text-center">
                                    <Badge variant="outline" className="bg-muted/50 text-muted-foreground">
                                        {new Date(customerSale.created_at).toLocaleDateString()}
                                    </Badge>
                                </td>

                                <td className="p-4 text-center">
                                    <Badge variant={customerSale.status === "ACTIVE" ? "default" : "destructive"} className="px-2 py-1 text-muted-foreground">
                                        {customerSale.status === "ACTIVE" ? "✅ Activa" : "❌ Cerrada"}
                                    </Badge>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredCustomerSales.length === 0 && (
                    <div className="text-center py-12">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <div className="text-lg font-medium text-muted-foreground mb-2">
                            {customerSales.length === 0
                                ? "No hay ventas registradas"
                                : "No se encontraron ventas"
                            }
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {customerSales.length === 0
                                ? "Comienza agregando tu primer venta"
                                : "Intenta con otros términos de búsqueda"
                            }
                        </div>
                    </div>
                )}
            </div>

            {/* Footer con información */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
                <div>
                    Mostrando {filteredCustomerSales.length} de {customerSales.length} ventas
                </div>
                <div>
                    Última actualización: {new Date().toLocaleTimeString()}
                </div>
            </div>

            {/* Modal para crear/editar cliente */}
            {/* {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold">
                                {editingCustomer ? "Editar Venta" : "Nueva Venta"}
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
            )} */}
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
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">RFC/ID Fiscal</label>
                <Input
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    placeholder="RFC o identificación fiscal"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="cliente@email.com"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+52 555 123 4567"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">Dirección</label>
                <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Dirección completa del cliente"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background min-h-[80px] resize-none"
                />
            </div>

            <div className="flex items-center space-x-2">
                <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
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

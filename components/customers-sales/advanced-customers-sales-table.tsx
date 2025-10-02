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
    Check,
    ShoppingBag,
    Clock,
    AlertTriangle
} from "lucide-react";
import { Customer, CustomerSales } from "@/lib/types/inventory";
import { getCustomer, getCustomerSales } from "@/lib/functions/customer";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";

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
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [order, setOrder] = useState<CustomerSales | null>(null);
    const [paymentError, setPaymentError] = useState<string>("");
    const { success, error: showError } = useToast();

    useEffect(() => {
        fetchCustomers();
    }, []);

    // Función de validación
    const validatePaymentAmount = (amount: number) => {
        if (amount > (order?.remaining_amount || 0)) {
            setPaymentError(`El monto no puede exceder $${order?.remaining_amount?.toFixed(2)}`);
            return false;
        } else {
            setPaymentError("");
            return true;
        }
    };

    const resetPaymentForm = () => {
        setShowPaymentModal(false);
        setPaymentAmount(0);
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!paymentAmount || paymentAmount <= 0) {
            toast.error('El monto debe ser mayor a 0');
            return;
        }

        try {
            const supabase = createClient();
            const { data, error } = await supabase
                .rpc("process_payment", {
                    order_id: order?.id,
                    payment_amount: paymentAmount
                });

            if (error) {
                console.error('Error creating payment:', error);
                toast.error('Error al crear el pago');
                return;
            }

            const result = data[0] as any;

            if (result.success === true) {
                toast.success('Pago creado exitosamente');
                fetchCustomers();
                resetPaymentForm();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            console.error('Error creating payment:', error);
            toast.error('Error al crear el pago');
        }
    };


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
            (statusFilter === "OPEN" && customerSale.status === "OPEN") ||
            (statusFilter === "COMPLETED" && customerSale.status === "COMPLETED") ||
            (statusFilter === "PARTIAL" && customerSale.status === "PARTIAL") ||
            (statusFilter === "ENDED" && customerSale.status === "ENDED") ||
            (statusFilter === "CANCELLED" && customerSale.status === "CANCELLED");

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
    const endedCustomerSales = customerSales.filter(c => c.status === 'ENDED').length;
    const pendingCustomerSales = customerSales.filter(c => c.status === 'PARTIAL').length;
    const totalRevenue = customerSales.reduce((sum, c) => sum + (c.paid_amount || 0), 0);
    const totalPending = customerSales.reduce((sum, c) => sum + (c.remaining_amount || 0), 0);
    const totalEstimated = customerSales.reduce((sum, c) => sum + (c.total || 0), 0);

    return (
        <div className="space-y-6">
            {/* Header con estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
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
                        <CardTitle className="text-sm font-medium">Numero de ventas a credito</CardTitle>
                        <Clock className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">{pendingCustomerSales}</div>
                        <p className="text-xs text-muted-foreground">
                            Ventas a credito
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completadas</CardTitle>
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
                        <CardTitle className="text-sm font-medium">Finalizadas</CardTitle>
                        <TrendingUp className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">{endedCustomerSales}</div>
                        <p className="text-xs text-muted-foreground">
                            {((endedCustomerSales / totalCustomerSales) * 100).toFixed(1)}% del total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total ingresos estimados</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">${totalEstimated.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            Total ingresos estimados
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total ingresos pagados</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">${totalRevenue.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            Total ingresos pagados
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total ingresos por pagar</CardTitle>
                        <DollarSign className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">${totalPending.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            Ventas pendientes
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
                            <option value="OPEN">📋 Abiertas</option>
                            <option value="PARTIAL">⏳ En Pagos</option>
                            <option value="COMPLETED">✅ Completadas</option>
                            <option value="ENDED">📦 Finalizadas</option>
                            <option value="CANCELLED">❌ Canceladas</option>
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
                                        <Link className="hover:underline cursor-pointer hover:animate-pulse hover:animate-infinite hover:animate-duration-[0.5s] hover:animate-ease-in-out" href={`/sales/${customerSale.id}`}>
                                            <div className="font-medium text-foreground flex items-center gap-2">
                                                🛒 {customerSale.order_number || customerSale.id}
                                            </div>
                                        </Link>
                                        {customerSale.customer_id && (
                                            <div className="text-sm text-muted-foreground">
                                                <div className="truncate max-w-[200px]" title={customerSale.customer_id}>
                                                    Cliente: {customerSale.customer_id}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                            <Badge variant="outline" className="bg-gray-100/10 text-gray-5\400 border-gray-700 hover:bg-gray-100/20 p-2">
                                                {
                                                    customerSale.status === "OPEN" ? "📋 ABIERTA"
                                                        : customerSale.status === "PARTIAL" ? "⏳ EN PAGOS"
                                                            : customerSale.status === "COMPLETED" ? "✅ COMPLETADA"
                                                                : customerSale.status === "ENDED" ? "📦 FINALIZADA"
                                                                    : customerSale.status === "CANCELLED" ? "❌ CANCELADA" : "⏳ VENCIDA"}
                                            </Badge>
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4">
                                    <div className="space-y-1">
                                        {(customerSale.total || customerSale.subtotal) && (
                                            <div className="flex items-center justify-center gap-2 text-sm w-full p-2">
                                                <div className="text-center w-full">Total: {(customerSale.subtotal || customerSale.tax).toFixed(2)}</div>
                                            </div>
                                        )}
                                        {(customerSale.status !== "COMPLETED" && customerSale.status !== "ENDED" && customerSale.status !== "CANCELLED") && (
                                            <div className="flex flex-col items-center justify-center gap-2 text-sm">
                                                <Badge variant="outline" className="bg-amber-700 text-gray-100 border-amber-600 hover:bg-amber-600/90 p-1 w-40">
                                                    <div className="text-center w-full">💰 Restante: <span className="font-bold">${(customerSale.remaining_amount || 0).toFixed(2)}</span></div>
                                                </Badge>
                                                <Badge variant="outline" className="bg-gray-100/10 text-green-700 border-gray-700 hover:bg-gray-100/20 p-1 w-40">
                                                    <div className="text-center w-full">💰 Pagado: <span className="font-bold text-md">${(customerSale.paid_amount || 0).toFixed(2)}</span></div>
                                                </Badge>
                                            </div>
                                        )}
                                        {(customerSale.status === "COMPLETED" || customerSale.status === "ENDED" || customerSale.status === "CANCELLED") && (
                                            <div className="flex flex-col items-center justify-center gap-2 text-sm">
                                                <Badge variant="outline" className="bg-gray-100/10 text-green-700 border-gray-700 hover:bg-gray-100/20 p-1 w-28">
                                                    <div className="text-center w-full">Pagado</div>
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                </td>

                                <td className="p-4 text-center">
                                    <div className="space-y-1">
                                        <div className="font-medium">{customerSale.notes}</div>
                                        <div className="text-sm font-medium text-primary">
                                            💰 ${(customerSale.total || 0).toFixed(2)}
                                        </div>
                                        {customerSale.created_at && (
                                            <div className="text-xs text-muted-foreground">
                                                ⏰ Último abono: {new Date(customerSale.created_at).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                </td>

                                <td className="p-4 text-center">
                                    <Badge variant="outline" className="bg-slate-900 text-slate-100 border-slate-200 hover:bg-slate-600/80 p-2">
                                        📅 {new Date(customerSale.created_at).toLocaleDateString()}
                                    </Badge>
                                </td>

                                <td className="p-4 text-center">
                                    <Badge variant={customerSale.status === "OPEN" ? "default" : "secondary"}
                                        className={customerSale.status === "OPEN" ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-600/80 p-2"
                                            : customerSale.status === "PARTIAL" ? "bg-amber-700 text-gray-100 border-amber-600 hover:bg-amber-600/90 p-1 w-28"
                                                : customerSale.status === "COMPLETED" ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-600/80 p-2"
                                                    : customerSale.status === "ENDED" ? "bg-black-100 text-black-800 border-gray-200 hover:bg-black-600/80 p-2"
                                                        : customerSale.status === "CANCELLED" ? "bg-red-100 text-red-800 border-red-200 hover:bg-red-600/80 p-2" : "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-600/80 p-2"}>
                                        <div className="text-center w-full">{customerSale.status === "OPEN" ? "📋 ABIERTA"
                                            : customerSale.status === "PARTIAL" ? "⏳ EN PAGOS"
                                                : customerSale.status === "COMPLETED" ? "✅ COMPLETADA"
                                                    : customerSale.status === "ENDED" ? "📦 FINALIZADA"
                                                        : customerSale.status === "CANCELLED" ? "❌ CANCELADA" : "⏳ VENCIDA"}
                                        </div>
                                    </Badge>
                                    {customerSale.status === "PARTIAL" && (
                                        <Button
                                            variant="outline"
                                            className="ml-2"
                                            onClick={() => {
                                                setOrder(customerSale);
                                                setShowPaymentModal(true);
                                            }}
                                        >
                                            Abonar
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredCustomerSales.length === 0 && (
                    <div className="text-center py-12">
                        <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
            <Modal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                title="Editar Venta"
                size="lg"
            >
                <form onSubmit={handlePaymentSubmit}>
                    <div>
                        <Label htmlFor="amount">Monto</Label>
                        <Input
                            id="amount"
                            type="number"
                            min="0"
                            max={order?.remaining_amount || 0}
                            step="0.01"
                            value={paymentAmount}
                            onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setPaymentAmount(value);
                                validatePaymentAmount(value);
                            }}
                            placeholder={`Máximo: $${order?.remaining_amount?.toFixed(2) || 0}`}
                            className={paymentError ? "border-red-500 focus:border-red-500" : ""}
                        />
                        {paymentError && (
                            <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                                <AlertTriangle className="h-4 w-4" />
                                {paymentError}
                            </p>
                        )}                    </div>
                    <div className="flex gap-2 justify-end pt-4">
                        <Button type="button" variant="outline" onClick={resetPaymentForm}>
                            Cancelar
                        </Button>
                        <Button type="submit">Abonar</Button>
                    </div>
                </form>

            </Modal>
        </div>
    );
}





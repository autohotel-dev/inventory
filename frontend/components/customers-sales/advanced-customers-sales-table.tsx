"use client";

import { useState, useEffect, useMemo } from "react";
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
    AlertTriangle,
    ArrowDownCircle,
    Filter,
    CheckCircle2,
    Warehouse
} from "lucide-react";
import { Customer, CustomerSales } from "@/lib/types/inventory";

// Generar referencia única para pagos
function generatePaymentReference(prefix: string = "PAY"): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}
import { getCustomer, getCustomerSales } from "@/lib/functions/customer";
import { Modal } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";
import { MultiPaymentInput, PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";

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
    const [payments, setPayments] = useState<PaymentEntry[]>([]);
    const [order, setOrder] = useState<CustomerSales | null>(null);
    const { success, error: showError } = useToast();

    useEffect(() => {
        fetchCustomers();
    }, []);

    const resetPaymentForm = () => {
        setShowPaymentModal(false);
        setPayments([]);
    };

    const openPaymentModal = (sale: CustomerSales) => {
        setOrder(sale);
        setPayments(createInitialPayment(sale.remaining_amount || 0));
        setShowPaymentModal(true);
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

        if (totalAmount <= 0) {
            toast.error('El monto debe ser mayor a 0');
            return;
        }

        try {
            const supabase = createClient();

            // Insertar pagos de cliente
            const validPayments = payments.filter(p => p.amount > 0);
            const isMultipago = validPayments.length > 1;

            if (isMultipago) {
                // MULTIPAGO: Crear cargo principal + subpagos
                const { data: mainPayment, error: mainError } = await supabase
                    .from("payments")
                    .insert({
                        sales_order_id: order?.id,
                        amount: totalAmount,
                        payment_method: "PENDIENTE",
                        reference: generatePaymentReference("CLI"),
                        concept: "ABONO_CLIENTE",
                        status: "PAGADO",
                        payment_type: "COMPLETO",
                    })
                    .select("id")
                    .single();

                if (mainError) {
                    console.error("Error inserting main payment:", mainError);
                } else if (mainPayment) {
                    const subpayments = validPayments.map(p => ({
                        sales_order_id: order?.id,
                        amount: p.amount,
                        payment_method: p.method,
                        reference: p.reference || generatePaymentReference("SUB"),
                        concept: "ABONO_CLIENTE",
                        status: "PAGADO",
                        payment_type: "PARCIAL",
                        parent_payment_id: mainPayment.id,
                    }));

                    const { error: subError } = await supabase
                        .from("payments")
                        .insert(subpayments);

                    if (subError) {
                        console.error("Error inserting subpayments:", subError);
                    }
                }
            } else if (validPayments.length === 1) {
                // PAGO ÚNICO
                const p = validPayments[0];
                const { error: paymentsError } = await supabase
                    .from("payments")
                    .insert({
                        sales_order_id: order?.id,
                        amount: p.amount,
                        payment_method: p.method,
                        reference: p.reference || generatePaymentReference("CLI"),
                        concept: "ABONO_CLIENTE",
                        status: "PAGADO",
                        payment_type: "COMPLETO",
                    });

                if (paymentsError) {
                    console.error("Error inserting payment:", paymentsError);
                }
            }

            const { data, error } = await supabase
                .rpc("process_payment", {
                    order_id: order?.id,
                    payment_amount: totalAmount
                });

            if (error) {
                console.error('Error creating payment:', error);
                toast.error('Error al crear el pago');
                return;
            }

            const result = data[0] as any;

            if (result.success === true) {
                const methodsSummary = payments.map(p => `${p.method}: $${p.amount.toFixed(2)}`).join(', ');
                toast.success('Pago creado exitosamente', {
                    description: `Total: $${totalAmount.toFixed(2)} (${methodsSummary})`
                });
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

    // ⚡ Bolt Performance Optimization:
    // Memoizing the filtered customer sales array prevents expensive O(N) string matching and
    // filtering operations on every component re-render (e.g., when other state changes).
    const filteredCustomerSales = useMemo(() => customerSales.filter(customerSale => {
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
    }), [customerSales, search, statusFilter, warehouseFilter]);

    const {
        completedCustomerSales,
        endedCustomerSales,
        pendingCustomerSales,
        totalRevenue,
        totalPending,
        totalEstimated
    } = useMemo(() => {
        // ⚡ Bolt Performance Optimization:
        // Consolidating multiple .filter().length and .reduce() operations into a single iteration
        // over customerSales significantly reduces the number of loops from 6 to 1.
        return customerSales.reduce((acc, c) => {
            if (c.status === 'COMPLETED') acc.completedCustomerSales++;
            if (c.status === 'ENDED') acc.endedCustomerSales++;
            if (c.status === 'PARTIAL') acc.pendingCustomerSales++;
            acc.totalRevenue += (c.paid_amount || 0);
            acc.totalPending += (c.remaining_amount || 0);
            acc.totalEstimated += (c.total || 0);
            return acc;
        }, {
            completedCustomerSales: 0,
            endedCustomerSales: 0,
            pendingCustomerSales: 0,
            totalRevenue: 0,
            totalPending: 0,
            totalEstimated: 0
        });
    }, [customerSales]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const totalCustomerSales = customerSales.length;

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

                {/* Filtros con diseño premium */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Estado */}
                    <div className={`relative p-4 rounded-xl border transition-all duration-300 ${statusFilter ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-muted/30 border-border/50 hover:border-blue-500/30 hover:bg-blue-500/5'}`}>
                        <label className="flex items-center gap-2 text-sm font-medium mb-3">
                            <div className={`p-1.5 rounded-lg ${statusFilter ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500'}`}>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            </div>
                            <span className={statusFilter ? 'text-blue-400' : 'text-muted-foreground'}>Estado</span>
                        </label>
                        <div className="relative group">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full pl-4 pr-10 py-2.5 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-blue-500/30 focus:outline-none hover:bg-background shadow-sm"
                            >
                                <option value="">✨ Todos los estados</option>
                                <option value="OPEN">📋 Abiertas</option>
                                <option value="PARTIAL">⏳ En Pagos</option>
                                <option value="COMPLETED">✅ Completadas</option>
                                <option value="ENDED">📦 Finalizadas</option>
                                <option value="CANCELLED">❌ Canceladas</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:translate-y-[-45%]">
                                <div className={`p-1 rounded-md ${statusFilter ? 'bg-blue-500/20' : 'bg-muted'}`}>
                                    <ArrowDownCircle className={`h-4 w-4 ${statusFilter ? 'text-blue-500' : 'text-muted-foreground'}`} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Almacén */}
                    <div className={`relative p-4 rounded-xl border transition-all duration-300 ${warehouseFilter ? 'bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/30 shadow-lg shadow-purple-500/5' : 'bg-muted/30 border-border/50 hover:border-purple-500/30 hover:bg-purple-500/5'}`}>
                        <label className="flex items-center gap-2 text-sm font-medium mb-3">
                            <div className={`p-1.5 rounded-lg ${warehouseFilter ? 'bg-purple-500 text-white' : 'bg-purple-500/10 text-purple-500'}`}>
                                <Warehouse className="h-3.5 w-3.5" />
                            </div>
                            <span className={warehouseFilter ? 'text-purple-400' : 'text-muted-foreground'}>Almacén</span>
                        </label>
                        <div className="relative group">
                            <select
                                value={warehouseFilter}
                                onChange={(e) => setWarehouseFilter(e.target.value)}
                                className="w-full pl-4 pr-10 py-2.5 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-purple-500/30 focus:outline-none hover:bg-background shadow-sm"
                            >
                                <option value="">✨ Todos los almacenes</option>
                                <option value="warehouse1">🏭 Almacén 1</option>
                                <option value="warehouse2">🏭 Almacén 2</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:translate-y-[-45%]">
                                <div className={`p-1 rounded-md ${warehouseFilter ? 'bg-purple-500/20' : 'bg-muted'}`}>
                                    <ArrowDownCircle className={`h-4 w-4 ${warehouseFilter ? 'text-purple-500' : 'text-muted-foreground'}`} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Limpiar Filtros */}
                    <div className="flex items-end">
                        {(statusFilter || warehouseFilter || search) ? (
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setSearch("");
                                    setStatusFilter("");
                                    setWarehouseFilter("");
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

            {/* Tabla mejorada */}
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
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
                                            onClick={() => openPaymentModal(customerSale)}
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
                title="Registrar Pago"
                size="lg"
            >
                <form onSubmit={handlePaymentSubmit}>
                    <div className="space-y-4">
                        <MultiPaymentInput
                            totalAmount={order?.remaining_amount || 0}
                            payments={payments}
                            onPaymentsChange={setPayments}
                            showReference={true}
                        />
                    </div>
                    <div className="flex gap-2 justify-end pt-4">
                        <Button type="button" variant="outline" onClick={resetPaymentForm}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={payments.reduce((s, p) => s + p.amount, 0) <= 0}>
                            Abonar
                        </Button>
                    </div>
                </form>

            </Modal>
        </div>
    );
}





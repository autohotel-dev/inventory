"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
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
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter
} from "@/components/ui/card";
import {
    Clock,
    Truck,
    Package,
    CheckCircle2,
    AlertCircle,
    XCircle,
    User,
    ConciergeBell,
    MoreHorizontal,
    ChevronRight,
    Search,
    Filter,
    ArrowUpDown,
    Coins,
    CheckCircle,
    AlertTriangle,
    HandPlatter,
    Banknote,
    Loader2,
    MessageSquare,
    Info,
    CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/formatters";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { VALET_CONCEPTS } from "./payment/payment-constants";

type DeliveryStatus =
    | 'PENDING_VALET'
    | 'ACCEPTED'
    | 'IN_TRANSIT'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'ISSUE'
    | 'CANCELLED';

interface ConsumptionItem {
    id: string;
    qty: number;
    unit_price: number;
    total: number;
    is_paid: boolean;
    concept_type: string;
    delivery_status: DeliveryStatus | null;
    delivery_accepted_by: string | null;
    delivery_accepted_at: string | null;
    delivery_picked_up_at: string | null;
    delivery_picked_up_by: string | null;
    delivery_completed_at: string | null;
    payment_received_at: string | null;
    payment_received_by: string | null;
    payment_amount_received: number | null;
    tip_amount: number | null;
    tip_method: string | null;
    delivery_notes: string | null;
    cancellation_reason: string | null;
    issue_description: string | null;
    products: {
        name: string;
        sku?: string;
    } | null;
    valet_employee?: {
        first_name: string;
        last_name: string;
    } | null;
    created_at?: string;
}

interface ConsumptionTrackingModalProps {
    isOpen: boolean;
    onClose: () => void;
    salesOrderId: string | null;
    roomNumber: string;
    receptionistId: string;
    defaultFilter?: string;
}

const STATUS_CONFIG: Record<DeliveryStatus, {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: React.ReactNode;
    step: number;
}> = {
    'PENDING_VALET': { label: 'Esperando Cochero', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: <Clock className="h-4 w-4" />, step: 0 },
    'ACCEPTED': { label: 'Cochero Asignado', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <User className="h-4 w-4" />, step: 1 },
    'IN_TRANSIT': { label: 'En Camino', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: <Truck className="h-4 w-4" />, step: 2 },
    'DELIVERED': { label: 'Pendiente de Pago', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: <Package className="h-4 w-4" />, step: 3 },
    'COMPLETED': { label: 'Completado', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: <CheckCircle2 className="h-4 w-4" />, step: 4 },
    'ISSUE': { label: 'Problema', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <AlertCircle className="h-4 w-4" />, step: -1 },
    'CANCELLED': { label: 'Cancelado', color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: <XCircle className="h-4 w-4" />, step: -2 },
};

const STEPS = [
    { label: "Solicitado", status: "PENDING_VALET" },
    { label: "Asignado", status: "ACCEPTED" },
    { label: "En Camino", status: "IN_TRANSIT" },
    { label: "Entregado", status: "DELIVERED" },
    { label: "Pagado", status: "COMPLETED" }
];

export function ConsumptionTrackingModal({
    isOpen,
    onClose,
    salesOrderId,
    roomNumber,
    receptionistId,
    defaultFilter
}: ConsumptionTrackingModalProps) {
    const [consumptions, setConsumptions] = useState<ConsumptionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Estados para confirmación de pago
    const [confirmPaymentItem, setConfirmPaymentItem] = useState<ConsumptionItem | null>(null);
    const [receivedAmount, setReceivedAmount] = useState<number>(0);
    const [paymentNotes, setPaymentNotes] = useState("");
    const [activeFilter, setActiveFilter] = useState<string>('ALL');

    // Inicializar filtro por defecto
    useEffect(() => {
        if (defaultFilter) {
            setActiveFilter(defaultFilter);
        }
    }, [defaultFilter, isOpen]);

    const fetchConsumptions = useCallback(async (silent = false) => {
        if (!salesOrderId) return;

        if (!silent) setLoading(true);
        const supabase = createClient();

        try {
            const { data, error } = await supabase
                .from('sales_order_items')
                .select(`
                    *,
                    products:product_id ( name, sku ),
                    valet_employee:delivery_accepted_by ( first_name, last_name )
                `)
                .eq('sales_order_id', salesOrderId)
                .eq('concept_type', 'CONSUMPTION')
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching consumptions:', error.message, error.details, error.hint);
                throw error;
            }
            setConsumptions(data || []);
        } catch (error) {
            console.error('Error fetching consumptions catch block:', error);
            if (!silent) toast.error('Error al cargar consumos');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [salesOrderId]);

    // Realtime Subscription
    useEffect(() => {
        if (!isOpen || !salesOrderId) return;

        fetchConsumptions();

        const supabase = createClient();
        const channel = supabase
            .channel(`tracking-${salesOrderId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'sales_order_items',
                    filter: `sales_order_id=eq.${salesOrderId}`
                },
                (payload: any) => {
                    console.log("🔄 Realtime update in tracking:", payload);
                    fetchConsumptions(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isOpen, salesOrderId, fetchConsumptions]);

    // Estadísticas rápidas
    const stats = useMemo(() => {
        const total = consumptions.length;
        const pending = consumptions.filter(c => c.delivery_status === 'PENDING_VALET').length;
        const accepted = consumptions.filter(c => c.delivery_status === 'ACCEPTED').length;
        const inTransit = consumptions.filter(c => c.delivery_status === 'IN_TRANSIT').length;
        const delivered = consumptions.filter(c => c.delivery_status === 'DELIVERED').length;
        const completed = consumptions.filter(c => c.delivery_status === 'COMPLETED').length;
        const totalAmount = consumptions.reduce((acc, c) => acc + Number(c.total), 0);

        return { total, pending, accepted, inTransit, delivered, completed, totalAmount };
    }, [consumptions]);

    const filteredConsumptions = useMemo(() => {
        if (activeFilter === 'ALL') return consumptions;
        if (activeFilter === 'PENDING') return consumptions.filter(c => c.delivery_status === 'PENDING_VALET');
        if (activeFilter === 'TRANSIT') return consumptions.filter(c => c.delivery_status === 'ACCEPTED' || c.delivery_status === 'IN_TRANSIT');
        if (activeFilter === 'DELIVERED') return consumptions.filter(c => c.delivery_status === 'DELIVERED');
        if (activeFilter === 'COMPLETED') return consumptions.filter(c => c.delivery_status === 'COMPLETED');
        return consumptions;
    }, [consumptions, activeFilter]);

    const handleConfirmPickup = async (item: ConsumptionItem) => {
        setActionLoading(item.id);
        const supabase = createClient();

        try {
            const { error } = await supabase
                .from('sales_order_items')
                .update({
                    delivery_status: 'IN_TRANSIT',
                    delivery_picked_up_at: new Date().toISOString(),
                    delivery_picked_up_by: receptionistId
                })
                .eq('id', item.id);

            if (error) throw error;
            toast.success('Recogida confirmada');
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al confirmar');
        } finally {
            setActionLoading(null);
        }
    };

    const openPaymentConfirmation = (item: ConsumptionItem) => {
        const tipInCash = item.tip_method === 'EFECTIVO' ? Number(item.tip_amount || 0) : 0;
        setReceivedAmount(Number(item.total) + tipInCash);
        setPaymentNotes("");
        setConfirmPaymentItem(item);
    };

    const handleConfirmPayment = async () => {
        if (!confirmPaymentItem) return;

        setActionLoading(confirmPaymentItem.id);
        const supabase = createClient();

        try {
            const { error } = await supabase
                .from('sales_order_items')
                .update({
                    delivery_status: 'COMPLETED',
                    payment_received_at: new Date().toISOString(),
                    payment_received_by: receptionistId,
                    payment_amount_received: receivedAmount,
                    delivery_notes: paymentNotes || confirmPaymentItem.delivery_notes
                })
                .eq('id', confirmPaymentItem.id);

            if (error) throw error;

            toast.success('Entrega completada');
            setConfirmPaymentItem(null);
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al confirmar');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReportIssue = async (item: ConsumptionItem) => {
        const description = prompt('Describe el problema:');
        if (!description) return;

        setActionLoading(item.id);
        const supabase = createClient();

        try {
            const { error } = await supabase
                .from('sales_order_items')
                .update({
                    delivery_status: 'ISSUE',
                    issue_description: description
                })
                .eq('id', item.id);

            if (error) throw error;
            toast.warning('Problema reportado');
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al reportar');
        } finally {
            setActionLoading(null);
        }
    };

    const handleConfirmAllPickups = async () => {
        const acceptedItems = consumptions.filter(c => c.delivery_status === 'ACCEPTED');
        if (acceptedItems.length === 0) return;

        setActionLoading('bulk-pickup');
        const supabase = createClient();

        try {
            await supabase
                .from('sales_order_items')
                .update({
                    delivery_status: 'IN_TRANSIT',
                    delivery_picked_up_at: new Date().toISOString(),
                    delivery_picked_up_by: receptionistId
                })
                .in('id', acceptedItems.map(i => i.id));
            toast.success('Recogidas confirmadas');
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleConfirmAllPayments = async () => {
        const deliveredItems = consumptions.filter(c => c.delivery_status === 'DELIVERED');
        if (deliveredItems.length === 0) return;

        setActionLoading('bulk-payment');
        const supabase = createClient();

        try {
            await supabase
                .from('sales_order_items')
                .update({
                    delivery_status: 'COMPLETED',
                    payment_received_at: new Date().toISOString(),
                    payment_received_by: receptionistId
                })
                .in('id', deliveredItems.map(i => i.id));
            toast.success('Pagos confirmados');
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-[700px] lg:max-w-[1000px] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-none bg-background/95 backdrop-blur-xl shadow-2xl">
                    <DialogHeader className="px-8 py-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
                                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                        <ConciergeBell className="h-6 w-6" />
                                    </div>
                                    Seguimiento de Servicios
                                </DialogTitle>
                                <DialogDescription className="text-base flex items-center gap-2">
                                    Habitación <span className="font-bold text-foreground">{roomNumber}</span> • 
                                    <span className="flex items-center gap-1 text-emerald-500 font-medium">
                                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        En Vivo
                                    </span>
                                </DialogDescription>
                            </div>

                            <div className="hidden md:flex gap-4">
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Consumos</p>
                                    <p className="text-2xl font-black text-primary">{formatCurrency(stats.totalAmount)}</p>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Dashboard de resumen */}
                    <div className="px-8 py-4 bg-muted/30 flex flex-wrap gap-4 border-b">
                        <button
                            onClick={() => setActiveFilter(activeFilter === 'PENDING' ? 'ALL' : 'PENDING')}
                            className={cn(
                                "flex-1 min-w-[140px] p-3 rounded-xl border transition-all flex items-center gap-3",
                                activeFilter === 'PENDING' ? "bg-amber-500 border-amber-600 shadow-md transform scale-105" : "bg-background border-border hover:border-amber-500/50 shadow-sm"
                            )}
                        >
                            <div className={cn(
                                "p-2 rounded-lg transition-colors",
                                activeFilter === 'PENDING' ? "bg-white/20 text-white" : "bg-amber-500/10 text-amber-600"
                            )}>
                                <Clock className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                                <p className={cn(
                                    "text-[10px] uppercase font-bold tracking-wider leading-none mb-1",
                                    activeFilter === 'PENDING' ? "text-white/80" : "text-muted-foreground"
                                )}>Pendientes</p>
                                <p className={cn(
                                    "text-lg font-bold leading-none",
                                    activeFilter === 'PENDING' ? "text-white" : "text-foreground"
                                )}>{stats.pending}</p>
                            </div>
                        </button>

                        <button
                            onClick={() => setActiveFilter(activeFilter === 'TRANSIT' ? 'ALL' : 'TRANSIT')}
                            className={cn(
                                "flex-1 min-w-[140px] p-3 rounded-xl border transition-all flex items-center gap-3",
                                activeFilter === 'TRANSIT' ? "bg-purple-500 border-purple-600 shadow-md transform scale-105" : "bg-background border-border hover:border-purple-500/50 shadow-sm"
                            )}
                        >
                            <div className={cn(
                                "p-2 rounded-lg transition-colors",
                                activeFilter === 'TRANSIT' ? "bg-white/20 text-white" : "bg-purple-500/10 text-purple-600"
                            )}>
                                <Truck className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                                <p className={cn(
                                    "text-[10px] uppercase font-bold tracking-wider leading-none mb-1",
                                    activeFilter === 'TRANSIT' ? "text-white/80" : "text-muted-foreground"
                                )}>En Camino</p>
                                <p className={cn(
                                    "text-lg font-bold leading-none",
                                    activeFilter === 'TRANSIT' ? "text-white" : "text-foreground"
                                )}>{stats.accepted + stats.inTransit}</p>
                            </div>
                        </button>

                        <button
                            onClick={() => setActiveFilter(activeFilter === 'DELIVERED' ? 'ALL' : 'DELIVERED')}
                            className={cn(
                                "flex-1 min-w-[140px] p-3 rounded-xl border transition-all flex items-center gap-3",
                                activeFilter === 'DELIVERED' ? "bg-orange-500 border-orange-600 shadow-md transform scale-105" : "bg-background border-border hover:border-orange-500/50 shadow-sm"
                            )}
                        >
                            <div className={cn(
                                "p-2 rounded-lg transition-colors",
                                activeFilter === 'DELIVERED' ? "bg-white/20 text-white" : "bg-orange-500/10 text-orange-600"
                            )}>
                                <Coins className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                                <p className={cn(
                                    "text-[10px] uppercase font-bold tracking-wider leading-none mb-1",
                                    activeFilter === 'DELIVERED' ? "text-white/80" : "text-muted-foreground"
                                )}>Por Cobrar</p>
                                <p className={cn(
                                    "text-lg font-bold leading-none",
                                    activeFilter === 'DELIVERED' ? "text-white" : "text-foreground"
                                )}>{stats.delivered}</p>
                            </div>
                        </button>

                        <button
                            onClick={() => setActiveFilter(activeFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
                            className={cn(
                                "flex-1 min-w-[140px] p-3 rounded-xl border transition-all flex items-center gap-3",
                                activeFilter === 'COMPLETED' ? "bg-green-600 border-green-700 shadow-md transform scale-105" : "bg-background border-border hover:border-green-500/50 shadow-sm"
                            )}
                        >
                            <div className={cn(
                                "p-2 rounded-lg transition-colors",
                                activeFilter === 'COMPLETED' ? "bg-white/20 text-white" : "bg-green-500/10 text-green-600"
                            )}>
                                <CheckCircle className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                                <p className={cn(
                                    "text-[10px] uppercase font-bold tracking-wider leading-none mb-1",
                                    activeFilter === 'COMPLETED' ? "text-white/80" : "text-muted-foreground"
                                )}>Completados</p>
                                <p className={cn(
                                    "text-lg font-bold leading-none",
                                    activeFilter === 'COMPLETED' ? "text-white" : "text-foreground"
                                )}>{stats.completed}</p>
                            </div>
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto p-8 bg-slate-50/50 dark:bg-slate-900/50">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                <p className="text-muted-foreground animate-pulse">Actualizando estados...</p>
                            </div>
                        ) : filteredConsumptions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                <div className="p-4 bg-muted rounded-full">
                                    <ConciergeBell className="h-12 w-12 text-muted-foreground/30" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">
                                        {activeFilter === 'ALL' ? 'Sin servicios activos' : 'No hay consumos con este estatus'}
                                    </h3>
                                    <p className="text-muted-foreground max-w-xs mx-auto">
                                        {activeFilter === 'ALL'
                                            ? 'No hay pedidos de consumo o servicios de cochero registrados para esta habitación.'
                                            : `No se encontraron consumos ${activeFilter.toLowerCase()} en este momento.`}
                                    </p>
                                    {activeFilter !== 'ALL' && (
                                        <Button
                                            variant="link"
                                            onClick={() => setActiveFilter('ALL')}
                                            className="mt-4"
                                        >
                                            Ver todos los consumos
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {filteredConsumptions.map((item) => {
                                    const status = item.delivery_status || 'PENDING_VALET';
                                    const config = STATUS_CONFIG[status];
                                    const isActionable = actionLoading === item.id;
                                    const currentStep = config.step;

                                    const minutesElapsed = item.created_at
                                        ? Math.floor((new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60))
                                        : 0;
                                    const isDelayed = ['PENDING_VALET', 'ACCEPTED'].includes(status) && minutesElapsed > 15;

                                    return (
                                        <Card key={item.id} className={cn(
                                            "overflow-hidden border-2 transition-all duration-300",
                                            status === 'ISSUE' ? "border-red-500/50 shadow-red-500/10" : "border-border/50 hover:border-primary/20 shadow-xl shadow-slate-200/50 dark:shadow-none"
                                        )}>
                                            <div className="p-6">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                    {/* Info del Producto */}
                                                    <div className="flex items-start gap-4 flex-1">
                                                        <div className={cn(
                                                            "p-3 rounded-xl shrink-0",
                                                            config.bg, config.color
                                                        )}>
                                                            {config.icon}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-lg leading-tight uppercase tracking-tight">
                                                                    {item.products?.name || 'Producto'}
                                                                </h4>
                                                                <Badge variant="secondary" className="font-mono font-bold">
                                                                    x{item.qty}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                                <span className="font-bold text-foreground">{formatCurrency(item.total)}</span>
                                                                <span>•</span>
                                                                <span className={cn(
                                                                    "flex items-center gap-1 font-medium",
                                                                    isDelayed ? "text-red-500 animate-pulse font-bold" : "text-muted-foreground"
                                                                )}>
                                                                    <Clock className="h-3 w-3" />
                                                                    {minutesElapsed} min
                                                                    {isDelayed && <AlertTriangle className="ml-1 h-3 w-3" />}
                                                                </span>
                                                                <span>•</span>
                                                                <span className="flex items-center gap-1">
                                                                    <User className="h-3 w-3" />
                                                                    {item.valet_employee ? `${item.valet_employee.first_name}` : 'Sin cochero'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Stepper Visual */}
                                                    <div className="flex-1 max-w-md w-full">
                                                        <div className="relative flex justify-between">
                                                            {/* Linea de fondo */}
                                                            <div className="absolute top-4 left-0 w-full h-0.5 bg-muted -z-0" />
                                                            {/* Linea de progreso */}
                                                            <div
                                                                className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-500 -z-0"
                                                                style={{ width: `${Math.max(0, currentStep) * 25}%` }}
                                                            />

                                                            {STEPS.map((step, idx) => {
                                                                const isCompleted = currentStep >= idx;
                                                                const isCurrent = currentStep === idx;
                                                                return (
                                                                    <div key={step.status} className="flex flex-col items-center gap-2 relative z-10">
                                                                        <div className={cn(
                                                                            "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                                                                            isCompleted ? "bg-primary border-primary text-primary-foreground" : "bg-background border-muted text-muted-foreground",
                                                                            isCurrent && "ring-4 ring-primary/20 scale-110"
                                                                        )}>
                                                                            {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <div className="h-1.5 w-1.5 rounded-full bg-current" />}
                                                                        </div>
                                                                        <span className={cn(
                                                                            "text-[10px] font-bold uppercase tracking-tighter",
                                                                            isCurrent ? "text-primary" : "text-muted-foreground"
                                                                        )}>
                                                                            {step.label}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Acciones */}
                                                    <div className="flex items-center gap-2">
                                                        {status === 'ACCEPTED' && (
                                                            <Button
                                                                variant="default"
                                                                onClick={() => handleConfirmPickup(item)}
                                                                disabled={isActionable}
                                                                className="shrink-0"
                                                            >
                                                                {isActionable ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <HandPlatter className="h-4 w-4 mr-2" />}
                                                                Confirmar Recogida
                                                            </Button>
                                                        )}

                                                        {status === 'DELIVERED' && (
                                                            <Button
                                                                variant="default"
                                                                onClick={() => openPaymentConfirmation(item)}
                                                                disabled={isActionable}
                                                                className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                                                            >
                                                                {isActionable ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
                                                                Validar Pago
                                                            </Button>
                                                        )}

                                                        {['ACCEPTED', 'IN_TRANSIT', 'DELIVERED'].includes(status) && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-48">
                                                                    <DropdownMenuLabel>Gestión de Servicio</DropdownMenuLabel>
                                                                    <DropdownMenuItem onClick={() => handleReportIssue(item)} className="text-destructive">
                                                                        <AlertCircle className="mr-2 h-4 w-4" />
                                                                        Reportar Problema
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Notas y Problemas */}
                                                {(item.delivery_notes || item.issue_description) && (
                                                    <div className="mt-4 pt-4 border-t flex flex-wrap gap-4">
                                                        {item.delivery_notes && (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
                                                                <MessageSquare className="h-3.5 w-3.5" />
                                                                <span className="font-medium text-foreground">Nota:</span> {item.delivery_notes}
                                                            </div>
                                                        )}
                                                        {item.issue_description && (
                                                            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-1.5 rounded-lg border border-destructive/20">
                                                                <AlertCircle className="h-3.5 w-3.5" />
                                                                <span className="font-bold">Incidencia:</span> {item.issue_description}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="p-8 border-t flex flex-col md:flex-row justify-between items-center bg-background gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                variant="outline"
                                onClick={handleConfirmAllPickups}
                                disabled={actionLoading === 'bulk-pickup' || stats.accepted === 0}
                                className="border-primary/20 hover:bg-muted group transition-all"
                            >
                                <HandPlatter className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                                Todo Entregado a Cochero
                            </Button>
                            <Button
                                variant="default"
                                onClick={handleConfirmAllPayments}
                                disabled={actionLoading === 'bulk-payment' || stats.delivered === 0}
                                className="bg-green-600 hover:bg-green-700 shadow-sm transition-all text-white"
                            >
                                <Banknote className="h-4 w-4 mr-2" />
                                Confirmar Todos los Pagos
                            </Button>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Button variant="ghost" onClick={() => fetchConsumptions()} className="text-muted-foreground">
                                <Clock className="h-4 w-4 mr-2" />
                                Actualizar
                            </Button>
                            <Button variant="outline" onClick={onClose} className="px-8 font-bold">
                                Cerrar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de confirmación de pago */}
            <AlertDialog open={!!confirmPaymentItem} onOpenChange={(open) => !open && setConfirmPaymentItem(null)}>
                <AlertDialogContent className="max-w-md border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-3 text-xl">
                            <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                                <Banknote className="h-6 w-6" />
                            </div>
                            Validar Recepción de Dinero
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base pt-2">
                            Confirma que has recibido el efectivo/comprobante del cochero por el producto <span className="font-bold text-foreground underline decoration-primary/30">{confirmPaymentItem?.products?.name}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {confirmPaymentItem && (
                        <div className="space-y-6 py-4">
                            <div className="bg-slate-50 dark:bg-slate-900 border rounded-2xl p-5 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground font-medium">Costo del Producto</span>
                                    <span className="font-bold">{formatCurrency(Number(confirmPaymentItem.total))}</span>
                                </div>
                                {Number(confirmPaymentItem.tip_amount) > 0 && (
                                    <>
                                        <div className="flex justify-between items-center text-amber-600 font-medium pb-2 border-b border-dashed">
                                            <span>Propina ({confirmPaymentItem.tip_method})</span>
                                            <span>+{formatCurrency(Number(confirmPaymentItem.tip_amount))}</span>
                                        </div>
                                        {confirmPaymentItem.tip_method === 'EFECTIVO' && (
                                            <div className="flex justify-between items-center pt-1">
                                                <span className="font-bold text-lg">Total a Recibir</span>
                                                <span className="text-2xl font-black text-green-600">
                                                    {formatCurrency(Number(confirmPaymentItem.total) + Number(confirmPaymentItem.tip_amount))}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase tracking-tight text-muted-foreground">Monto Real Recibido</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground group-focus-within:text-green-600 transition-colors">$</div>
                                        <Input
                                            type="number"
                                            value={receivedAmount}
                                            onChange={(e) => setReceivedAmount(Number(e.target.value))}
                                            className="pl-10 h-14 text-2xl font-black rounded-2xl border-2 focus-visible:ring-green-500/20 focus-visible:border-green-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase tracking-tight text-muted-foreground">Notas de Recepción</label>
                                    <Textarea
                                        placeholder="Detalles sobre el dinero o entrega..."
                                        value={paymentNotes}
                                        onChange={(e) => setPaymentNotes(e.target.value)}
                                        rows={3}
                                        className="rounded-2xl border-2 focus-visible:ring-primary/20"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <AlertDialogFooter className="gap-2 sm:gap-0">
                        <AlertDialogCancel className="rounded-xl border-2 hover:bg-slate-100 transition-colors">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmPayment}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-green-200 transition-all active:scale-95"
                            disabled={actionLoading === confirmPaymentItem?.id}
                        >
                            {actionLoading === confirmPaymentItem?.id ? (
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            ) : (
                                <CheckCircle2 className="h-5 w-5 mr-2" />
                            )}
                            Finalizar Seguimiento
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

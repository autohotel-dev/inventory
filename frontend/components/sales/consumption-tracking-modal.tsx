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
    LucideIcon,
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
    CreditCard,
    Zap,
    History,
    ChevronUp,
    ChevronDown,
    DollarSign,
    PackageCheck,
    TruckIcon,
    ShoppingBag,
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
    onRefresh?: () => void;
    salesOrderId: string | null;
    roomNumber: string;
    receptionistId: string;
    defaultFilter?: string;
}

const STATUS_CONFIG: Record<DeliveryStatus, {
    label: string;
    color: string;
    accent: string;
    bg: string;
    border: string;
    icon: LucideIcon;
    step: number;
}> = {
    'PENDING_VALET': { label: 'Esperando Cochero', color: 'text-amber-500', accent: 'bg-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Clock, step: 0 },
    'ACCEPTED': { label: 'Cochero Asignado', color: 'text-blue-500', accent: 'bg-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: User, step: 1 },
    'IN_TRANSIT': { label: 'En Camino', color: 'text-violet-500', accent: 'bg-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20', icon: Truck, step: 2 },
    'DELIVERED': { label: 'Pendiente de Pago', color: 'text-pink-500', accent: 'bg-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/20', icon: Package, step: 3 },
    'COMPLETED': { label: 'Completado', color: 'text-emerald-500', accent: 'bg-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2, step: 4 },
    'ISSUE': { label: 'Problema', color: 'text-red-500', accent: 'bg-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertCircle, step: -1 },
    'CANCELLED': { label: 'Cancelado', color: 'text-zinc-500', accent: 'bg-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', icon: XCircle, step: -2 },
};

const STEPS: { status: DeliveryStatus; label: string; icon: LucideIcon }[] = [
    { status: 'PENDING_VALET', label: 'Pendiente', icon: Clock },
    { status: 'ACCEPTED', label: 'Asignado', icon: User },
    { status: 'IN_TRANSIT', label: 'En Camino', icon: TruckIcon },
    { status: 'DELIVERED', label: 'Entregado', icon: PackageCheck },
    { status: 'COMPLETED', label: 'Pagado', icon: Banknote },
];

export function ConsumptionTrackingModal({
    isOpen,
    onClose,
    onRefresh,
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

            if (error) throw error;
            setConsumptions(data || []);
        } catch (error) {
            console.error('Error fetching consumptions:', error);
            if (!silent) toast.error('Error al cargar consumos');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [salesOrderId]);

    // Realtime Subscription — sin filtro en el canal (los filtros por columna
    // requieren configuración especial en la publicación de Supabase).
    // En su lugar, verificamos el sales_order_id en el callback.
    useEffect(() => {
        if (!isOpen || !salesOrderId) return;

        fetchConsumptions();

        const supabase = createClient();
        let isSubscribed = true;

        const setup = async () => {
            // Asegurar auth token para realtime
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                    supabase.realtime.setAuth(session.access_token);
                }
            } catch { /* noop */ }

            const channel = supabase
                .channel(`tracking-${salesOrderId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'sales_order_items',
                    },
                    (payload: any) => {
                        if (!isSubscribed) return;
                        // Verificar que el cambio es para nuestra orden
                        const record = payload.new || payload.old;
                        if (record?.sales_order_id === salesOrderId) {
                            fetchConsumptions(true);
                        }
                    }
                )
                .subscribe((status: string) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ [Tracking] Realtime conectado para orden:', salesOrderId);
                    } else if (status === 'CHANNEL_ERROR') {
                        console.warn('⚠️ [Tracking] Error en canal realtime');
                    }
                });

            return channel;
        };

        let channelRef: ReturnType<typeof supabase.channel> | null = null;
        setup().then(ch => { channelRef = ch; });

        return () => {
            isSubscribed = false;
            if (channelRef) supabase.removeChannel(channelRef);
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
            onRefresh?.();
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
            onRefresh?.();
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="w-[95vw] sm:w-full sm:max-w-[700px] lg:max-w-[1000px] max-h-[100dvh] md:max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-none bg-zinc-950/95 backdrop-blur-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] rounded-none md:rounded-[2rem] inset-0 md:inset-auto md:left-[50%] md:top-[50%] md:translate-x-[-50%] md:translate-y-[-50%] translate-x-0 translate-y-0">
                    <DialogHeader className="px-4 md:px-8 py-5 md:py-7 bg-zinc-900/50 border-b border-white/5 relative overflow-hidden shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50"></div>
                        <div className="relative flex items-center justify-between">
                            <div className="space-y-1">
                                <DialogTitle className="flex items-center gap-3 md:gap-4 text-xl md:text-3xl font-black tracking-tighter text-white uppercase italic">
                                    <div className="p-2.5 md:p-3 bg-primary/20 rounded-xl md:rounded-2xl text-primary border border-primary/30 shadow-[0_0_15px_-5px_var(--primary)]">
                                        <ConciergeBell className="h-5 w-5 md:h-7 md:w-7" />
                                    </div>
                                    <span className="hidden sm:inline">Seguimiento de Servicios</span>
                                    <span className="sm:hidden">Servicios</span>
                                </DialogTitle>
                                <DialogDescription className="text-sm flex items-center gap-2 font-bold text-zinc-500 uppercase tracking-widest pl-1">
                                    Habitación <span className="text-white font-black italic">{roomNumber}</span>
                                    <span className="mx-2 opacity-20">|</span>
                                    <span className="flex items-center gap-1.5 text-emerald-500">
                                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        En Vivo
                                    </span>
                                </DialogDescription>
                            </div>

                            <div className="hidden md:flex gap-4">
                                <div className="bg-zinc-950/50 border border-white/5 rounded-2xl p-4 pr-10 relative overflow-hidden min-w-[180px]">
                                    <div className="absolute top-0 right-0 p-3 opacity-10">
                                        <ShoppingBag size={24} className="text-primary" />
                                    </div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-black mb-1">Total Consumos</p>
                                    <p className="text-3xl font-black text-primary italic tracking-tighter">{formatCurrency(stats.totalAmount)}</p>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Dashboard de resumen - Premium Cards */}
                    {/* Filter chips - horizontal scroll on mobile, grid on desktop */}
                    <div className="px-3 md:px-8 py-2.5 md:py-5 bg-zinc-950/50 border-b border-white/5 shrink-0 overflow-x-auto">
                        <div className="flex md:grid md:grid-cols-4 gap-2 md:gap-4 min-w-max md:min-w-0">
                            {[
                                { id: 'PENDING', label: 'Pend.', fullLabel: 'Pendientes', value: stats.pending, icon: Clock, color: 'amber', active: activeFilter === 'PENDING' },
                                { id: 'TRANSIT', label: 'Camino', fullLabel: 'En Camino', value: stats.accepted + stats.inTransit, icon: Truck, color: 'purple', active: activeFilter === 'TRANSIT' },
                                { id: 'DELIVERED', label: 'Cobrar', fullLabel: 'Por Cobrar', value: stats.delivered, icon: Coins, color: 'pink', active: activeFilter === 'DELIVERED' },
                                { id: 'COMPLETED', label: 'Listos', fullLabel: 'Completados', value: stats.completed, icon: CheckCircle, color: 'emerald', active: activeFilter === 'COMPLETED' },
                            ].map((card) => {
                                const colorMap = {
                                    amber: { active: 'bg-amber-500/20 border-amber-500/40', icon: 'bg-amber-500 text-white', iconInactive: 'bg-zinc-900 text-zinc-500', label: 'text-amber-400', labelInactive: 'text-zinc-500' },
                                    purple: { active: 'bg-purple-500/20 border-purple-500/40', icon: 'bg-purple-500 text-white', iconInactive: 'bg-zinc-900 text-zinc-500', label: 'text-purple-400', labelInactive: 'text-zinc-500' },
                                    pink: { active: 'bg-pink-500/20 border-pink-500/40', icon: 'bg-pink-500 text-white', iconInactive: 'bg-zinc-900 text-zinc-500', label: 'text-pink-400', labelInactive: 'text-zinc-500' },
                                    emerald: { active: 'bg-emerald-500/20 border-emerald-500/40', icon: 'bg-emerald-500 text-white', iconInactive: 'bg-zinc-900 text-zinc-500', label: 'text-emerald-400', labelInactive: 'text-zinc-500' },
                                };
                                const c = colorMap[card.color as keyof typeof colorMap];

                                return (
                                    <button
                                        key={card.id}
                                        onClick={() => setActiveFilter(activeFilter === card.id ? 'ALL' : card.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 md:p-4 rounded-xl md:rounded-2xl border transition-all duration-300 group whitespace-nowrap",
                                            card.active ? c.active : "bg-zinc-900/40 border-white/5"
                                        )}
                                    >
                                        <div className={cn("p-1.5 md:p-2.5 rounded-lg transition-all", card.active ? c.icon : c.iconInactive)}>
                                            <card.icon className="h-3.5 w-3.5 md:h-5 md:w-5" />
                                        </div>
                                        <div className="text-left">
                                            <p className={cn("text-[8px] md:text-[10px] uppercase font-black tracking-wider leading-none mb-0.5", card.active ? c.label : c.labelInactive)}>
                                                <span className="md:hidden">{card.label}</span>
                                                <span className="hidden md:inline">{card.fullLabel}</span>
                                            </p>
                                            <p className={cn("text-base md:text-2xl font-black italic tracking-tighter leading-none", card.active ? 'text-white' : 'text-zinc-300')}>{card.value}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-3 md:p-8 bg-zinc-900/10">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-24 gap-6">
                                <div className="relative h-16 w-16">
                                    <div className="absolute inset-0 border-4 border-primary/10 rounded-full" />
                                    <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_15px_-3px_var(--primary)]" />
                                    <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
                                </div>
                                <div className="space-y-1 text-center">
                                    <p className="text-white font-black uppercase tracking-[0.2em] italic">Sincronizando</p>
                                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Obteniendo estados en tiempo real...</p>
                                </div>
                            </div>
                        ) : filteredConsumptions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
                                <div className="p-8 bg-zinc-950/50 border border-white/5 rounded-[2.5rem] shadow-2xl relative group">
                                    <div className="absolute inset-0 bg-primary/5 rounded-[2.5rem] blur-2xl group-hover:bg-primary/10 transition-colors" />
                                    <ConciergeBell className="h-16 w-16 text-zinc-800 relative z-10" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
                                        {activeFilter === 'ALL' ? 'Sin servicios activos' : 'No hay coincidencias'}
                                    </h3>
                                    <p className="text-zinc-500 text-sm font-medium max-w-xs mx-auto uppercase tracking-wide px-4">
                                        {activeFilter === 'ALL'
                                            ? 'No hay pedidos de consumo o servicios registrados para esta habitación actualmente.'
                                            : `No se encontraron consumos con el estatus ${activeFilter.toLowerCase()} en este momento.`}
                                    </p>
                                    {activeFilter !== 'ALL' && (
                                        <Button
                                            variant="link"
                                            onClick={() => setActiveFilter('ALL')}
                                            className="mt-4 text-primary font-black uppercase tracking-widest italic hover:no-underline"
                                        >
                                            Ver todos los consumos <ChevronRight className="ml-1 h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:gap-8">
                                {filteredConsumptions.map((item) => {
                                    const status = item.delivery_status || 'PENDING_VALET';
                                    const config = STATUS_CONFIG[status];
                                    const isActionable = actionLoading === item.id;
                                    const currentStep = config.step;
                                    const StatusIconComp = config.icon;

                                    const minutesElapsed = item.created_at
                                        ? Math.floor((new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60))
                                        : 0;
                                    const isDelayed = ['PENDING_VALET', 'ACCEPTED'].includes(status) && minutesElapsed > 15;

                                    return (
                                        <div key={item.id} className={cn(
                                            "relative group transition-all duration-500",
                                            status === 'ISSUE' ? "opacity-100" : "hover:-translate-y-1"
                                        )}>
                                            {/* Glow de fondo para items destacados */}
                                            {isDelayed && (
                                                <div className="absolute -inset-1 bg-red-500/10 blur-xl rounded-[2rem] animate-pulse" />
                                            )}

                                            <Card className={cn(
                                                "relative overflow-hidden border-white/5 bg-zinc-900/40 backdrop-blur-xl rounded-[1.8rem] transition-all duration-500",
                                                status === 'ISSUE' ? "border-red-500/30 shadow-[0_0_30px_-10px_rgba(239,68,68,0.2)]" : "shadow-2xl shadow-black/40 border-white/5"
                                            )}>
                                                <div className="p-4 md:p-7">
                                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-8">
                                                        {/* Info del Producto */}
                                                        <div className="flex items-start gap-5 flex-1 min-w-0">
                                                            <div className={cn(
                                                                "p-3.5 rounded-2xl shrink-0 border transition-all duration-300 relative",
                                                                config.bg, config.color, config.border
                                                            )}>
                                                                <StatusIconComp className="h-6 w-6 relative z-10" />
                                                                <div className={cn("absolute inset-0 rounded-2xl opacity-20", config.accent)} />
                                                            </div>
                                                            <div className="space-y-1.5 min-w-0">
                                                                <div className="flex items-center gap-3">
                                                                    <h4 className="font-black text-base md:text-xl leading-none text-white uppercase italic tracking-tighter truncate">
                                                                        {item.products?.name || 'Producto'}
                                                                    </h4>
                                                                    <div className="px-2 py-0.5 rounded-lg bg-zinc-950 text-white font-black text-xs border border-white/10 shrink-0">
                                                                        x{item.qty}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.1em]">
                                                                    <span className="text-primary italic text-sm">{formatCurrency(item.total)}</span>
                                                                    <span className="text-zinc-700">|</span>
                                                                    <span className={cn(
                                                                        "flex items-center gap-1.5 transition-colors",
                                                                        isDelayed ? "text-red-500 animate-pulse" : "text-zinc-500"
                                                                    )}>
                                                                        <Clock className="h-3 w-3" />
                                                                        {minutesElapsed}m
                                                                        {isDelayed && <AlertTriangle className="h-3.5 w-3.5" />}
                                                                    </span>
                                                                    <span className="text-zinc-700">|</span>
                                                                    <span className="flex items-center gap-1.5 text-zinc-500 truncate max-w-[120px]">
                                                                        <User className="h-3 w-3" />
                                                                        {item.valet_employee ? item.valet_employee.first_name : 'Sin cochero'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Stepper Visual Premium */}
                                                        <div className="flex-1 max-w-xl w-full hidden md:block">
                                                            <div className="relative flex justify-between px-4">
                                                                {/* Linea de fondo */}
                                                                <div className="absolute top-5 left-8 right-8 h-[2px] bg-zinc-800 -z-0" />
                                                                {/* Linea de progreso con gradient */}
                                                                <div
                                                                    className={cn(
                                                                        "absolute top-5 left-8 h-[2px] transition-all duration-1000 ease-out -z-0 rounded-full",
                                                                        currentStep >= 4 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-primary"
                                                                    )}
                                                                    style={{ width: `calc(${Math.max(0, currentStep) * 25}% - 0px)` }}
                                                                />

                                                                {STEPS.map((step, idx) => {
                                                                    const isCompleted = currentStep >= idx;
                                                                    const isCurrent = currentStep === idx;
                                                                    const StepIcon = step.icon;

                                                                    return (
                                                                        <div key={step.status} className="flex flex-col items-center gap-3 relative z-10 w-12">
                                                                            <div className={cn(
                                                                                "h-10 w-10 rounded-xl flex items-center justify-center border-2 transition-all duration-500",
                                                                                isCompleted
                                                                                    ? "bg-zinc-950 border-primary text-primary shadow-[0_0_15px_-5px_var(--primary)]"
                                                                                    : "bg-zinc-950 border-zinc-800 text-zinc-700 opacity-50 grayscale",
                                                                                isCurrent && "scale-125 border-primary bg-primary text-white shadow-[0_0_20px_-2px_var(--primary)]"
                                                                            )}>
                                                                                <StepIcon className={cn("h-4.5 w-4.5", isCurrent && "animate-pulse")} />
                                                                            </div>
                                                                            <span className={cn(
                                                                                "text-[9px] font-black uppercase tracking-widest text-center whitespace-nowrap",
                                                                                isCurrent ? "text-white" : "text-zinc-600"
                                                                            )}>
                                                                                {step.label}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Acciones Premium */}
                                                        <div className="flex items-center gap-2 md:gap-3 md:pl-4 md:border-l border-white/5 lg:min-w-[180px] justify-start md:justify-end">
                                                            {status === 'ACCEPTED' && (
                                                                <Button
                                                                    onClick={() => handleConfirmPickup(item)}
                                                                    disabled={isActionable}
                                                                    className="bg-primary hover:bg-primary/90 text-zinc-950 font-black uppercase tracking-widest italic rounded-xl px-4 h-11 shadow-lg shadow-primary/20 shrink-0"
                                                                >
                                                                    {isActionable ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <HandPlatter className="h-4 w-4 mr-2" />}
                                                                    Recoger
                                                                </Button>
                                                            )}

                                                            {status === 'DELIVERED' && (
                                                                <Button
                                                                    onClick={() => openPaymentConfirmation(item)}
                                                                    disabled={isActionable}
                                                                    className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black uppercase tracking-widest italic rounded-xl px-4 h-11 shadow-lg shadow-emerald-500/20 shrink-0"
                                                                >
                                                                    {isActionable ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
                                                                    Pagar
                                                                </Button>
                                                            )}

                                                            {status === 'COMPLETED' && (
                                                                <div className="flex items-center gap-2 text-emerald-500 font-bold uppercase tracking-tighter italic mr-4">
                                                                    <CheckCircle2 size={18} />
                                                                    <span>Pagado</span>
                                                                </div>
                                                            )}

                                                            {['ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'].includes(status) && (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl bg-zinc-900/50 text-zinc-500 hover:text-white hover:bg-zinc-800 shrink-0 border border-white/5 transition-all">
                                                                            <MoreHorizontal className="h-5 w-5" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-56 bg-zinc-950 border-zinc-800 text-zinc-400 p-2 rounded-2xl shadow-2xl">
                                                                        <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-zinc-600 mb-1 px-3">Gestión de Servicio</DropdownMenuLabel>
                                                                        <DropdownMenuItem onClick={() => handleReportIssue(item)} className="rounded-xl focus:bg-red-500/10 focus:text-red-500 cursor-pointer p-3 transition-colors group">
                                                                            <AlertCircle className="mr-3 h-4.5 w-4.5 group-hover:animate-shake" />
                                                                            <span className="font-bold uppercase tracking-tight">Reportar Problema</span>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator className="bg-zinc-900 mx-2 my-2" />
                                                                        <DropdownMenuItem className="rounded-xl focus:bg-zinc-900 focus:text-white cursor-pointer p-3 transition-colors group">
                                                                            <History className="mr-3 h-4.5 w-4.5 group-hover:rotate-180 transition-transform duration-500" />
                                                                            <span className="font-bold uppercase tracking-tight text-white">Ver Historial</span>
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Notas y Problemas Stylized */}
                                                    {(item.delivery_notes || item.issue_description) && (
                                                        <div className="mt-5 pt-5 border-t border-white/5 flex flex-wrap gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                                                            {item.delivery_notes && (
                                                                <div className="flex items-center gap-3 text-[11px] text-zinc-400 bg-zinc-950/50 border border-white/5 pl-2 pr-4 py-2 rounded-xl group transition-colors hover:border-white/10">
                                                                    <div className="bg-zinc-900 p-1.5 rounded-lg">
                                                                        <MessageSquare size={12} className="text-zinc-500 group-hover:text-primary transition-colors" />
                                                                    </div>
                                                                    <span className="font-black text-zinc-500 uppercase tracking-widest shrink-0">Nota:</span>
                                                                    <span className="font-medium text-zinc-300 italic">{item.delivery_notes}</span>
                                                                </div>
                                                            )}
                                                            {item.issue_description && (
                                                                <div className="flex items-center gap-3 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 pl-2 pr-4 py-2 rounded-xl group animate-pulse">
                                                                    <div className="bg-red-500/20 p-1.5 rounded-lg">
                                                                        <AlertCircle size={12} className="text-red-500" />
                                                                    </div>
                                                                    <span className="font-black text-red-500 uppercase tracking-widest shrink-0">Incidencia:</span>
                                                                    <span className="font-bold text-red-200">{item.issue_description}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </Card>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer Premium */}
                    {/* Footer - compact on mobile */}
                    <div className="p-3 md:p-6 border-t border-white/5 bg-zinc-950 shrink-0 pb-safe">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleConfirmAllPickups}
                                    disabled={actionLoading === 'bulk-pickup' || stats.accepted === 0}
                                    size="sm"
                                    className="bg-zinc-900 border-white/5 hover:bg-primary hover:text-zinc-950 text-zinc-300 font-black uppercase tracking-wider italic rounded-xl h-9 md:h-11 px-3 md:px-5 text-[9px] md:text-[10px] transition-all"
                                >
                                    <HandPlatter size={14} className="mr-1.5 md:mr-2" />
                                    <span className="hidden sm:inline">Todo Entregado</span>
                                    <span className="sm:hidden">Entregado</span>
                                </Button>
                                <Button
                                    variant="default"
                                    onClick={handleConfirmAllPayments}
                                    disabled={actionLoading === 'bulk-payment' || stats.delivered === 0}
                                    size="sm"
                                    className="bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/30 text-emerald-500 hover:text-zinc-950 font-black uppercase tracking-wider italic rounded-xl h-9 md:h-11 px-3 md:px-5 text-[9px] md:text-[10px] transition-all"
                                >
                                    {actionLoading === 'bulk-payment' ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Banknote size={14} className="mr-1.5 md:mr-2" />}
                                    <span className="hidden sm:inline">Confirmar Pagos</span>
                                    <span className="sm:hidden">Pagos</span>
                                </Button>
                            </div>
                            <Button
                                variant="outline"
                                onClick={onClose}
                                size="sm"
                                className="bg-zinc-900 border-white/5 hover:bg-white hover:text-black text-zinc-300 font-black uppercase tracking-wider italic rounded-xl h-9 md:h-11 px-4 md:px-8 text-[9px] md:text-xs transition-all"
                            >
                                Cerrar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de confirmación de pago Premium */}
            <AlertDialog open={!!confirmPaymentItem} onOpenChange={(open) => !open && setConfirmPaymentItem(null)}>
                <AlertDialogContent className="max-w-md border-none shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] bg-zinc-950 backdrop-blur-3xl rounded-[2.5rem] p-0 overflow-hidden">
                    <div className="px-8 py-8 bg-zinc-900/50 border-b border-white/5 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-50"></div>
                        <AlertDialogHeader className="relative">
                            <AlertDialogTitle className="flex items-center gap-4 text-2xl font-black tracking-tighter text-white uppercase italic">
                                <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-500 border border-emerald-500/30">
                                    <Banknote className="h-7 w-7" />
                                </div>
                                Validar Pago
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-zinc-500 text-sm font-bold uppercase tracking-widest pt-2 pl-1 leading-relaxed">
                                Confirma la recepción del pago por <span className="text-white italic">{confirmPaymentItem?.products?.name}</span>.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                    </div>

                    {confirmPaymentItem && (
                        <div className="p-8 space-y-8">
                            <div className="bg-zinc-900/40 border border-white/5 rounded-[1.8rem] p-6 space-y-4 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <DollarSign size={48} className="text-emerald-500" />
                                </div>
                                <div className="flex justify-between items-center relative z-10">
                                    <span className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Costo del Producto</span>
                                    <span className="font-black text-white italic tracking-tighter text-lg">{formatCurrency(Number(confirmPaymentItem.total))}</span>
                                </div>
                                {Number(confirmPaymentItem.tip_amount) > 0 && (
                                    <>
                                        <div className="flex justify-between items-center text-emerald-500 font-black text-[10px] uppercase tracking-widest pb-3 border-b border-white/5 relative z-10">
                                            <span>Propina ({confirmPaymentItem.tip_method})</span>
                                            <span className="italic text-lg">+{formatCurrency(Number(confirmPaymentItem.tip_amount))}</span>
                                        </div>
                                        {confirmPaymentItem.tip_method === 'EFECTIVO' && (
                                            <div className="flex justify-between items-center pt-2 relative z-10">
                                                <span className="font-black text-zinc-400 uppercase tracking-widest text-[10px]">Total a Recibir</span>
                                                <span className="text-3xl font-black text-emerald-500 italic tracking-tighter animate-pulse shadow-emerald-500/20 drop-shadow-2xl">
                                                    {formatCurrency(Number(confirmPaymentItem.total) + Number(confirmPaymentItem.tip_amount))}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Monto Real Recibido</label>
                                    <div className="relative group">
                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black text-zinc-700 group-focus-within:text-emerald-500 transition-colors italic">$</div>
                                        <Input
                                            type="number"
                                            value={receivedAmount}
                                            onChange={(e) => setReceivedAmount(Number(e.target.value))}
                                            className="pl-12 h-16 text-3xl font-black italic tracking-tighter rounded-2xl border-white/5 bg-zinc-900/50 text-white focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500/50 transition-all text-right pr-6"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Notas de Recepción</label>
                                    <Textarea
                                        placeholder="Detalles sobre el dinero o entrega..."
                                        value={paymentNotes}
                                        onChange={(e) => setPaymentNotes(e.target.value)}
                                        rows={3}
                                        className="rounded-2xl border-white/5 bg-zinc-900/50 text-white focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-all font-medium placeholder:text-zinc-700 p-4"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <AlertDialogFooter className="p-8 pt-0 gap-3 sm:gap-4">
                        <AlertDialogCancel className="flex-1 rounded-2xl bg-zinc-900 border-white/5 text-zinc-400 font-black uppercase tracking-widest h-14 hover:bg-zinc-800 hover:text-white transition-all italic">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmPayment}
                            className="flex-[1.5] bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black uppercase tracking-widest h-14 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 italic"
                            disabled={actionLoading === confirmPaymentItem?.id}
                        >
                            {actionLoading === confirmPaymentItem?.id ? (
                                <Loader2 className="h-5 w-5 animate-spin mr-3 font-bold" />
                            ) : (
                                <PackageCheck className="h-5 w-5 mr-3 font-bold" />
                            )}
                            Finalizar Entrega
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

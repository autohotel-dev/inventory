"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
    Package,
    CheckCircle2,
    Clock,
    Truck,
    Banknote,
    AlertCircle,
    User,
    Loader2,
    CreditCard,
    XCircle,
    ConciergeBell,
    MoreHorizontal
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
}

interface ConsumptionTrackingModalProps {
    isOpen: boolean;
    onClose: () => void;
    salesOrderId: string | null;
    roomNumber: string;
    receptionistId: string;
}

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string; icon: React.ReactNode }> = {
    'PENDING_VALET': { label: 'Esperando', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Clock className="h-3 w-3" /> },
    'ACCEPTED': { label: 'Asignado', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <User className="h-3 w-3" /> },
    'IN_TRANSIT': { label: 'En camino', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: <Truck className="h-3 w-3" /> },
    'DELIVERED': { label: 'Entregado', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: <Package className="h-3 w-3" /> },
    'COMPLETED': { label: 'Completado', color: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle2 className="h-3 w-3" /> },
    'ISSUE': { label: 'Problema', color: 'bg-red-100 text-red-800 border-red-200', icon: <AlertCircle className="h-3 w-3" /> },
    'CANCELLED': { label: 'Cancelado', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: <XCircle className="h-3 w-3" /> },
};

export function ConsumptionTrackingModal({
    isOpen,
    onClose,
    salesOrderId,
    roomNumber,
    receptionistId
}: ConsumptionTrackingModalProps) {
    const [consumptions, setConsumptions] = useState<ConsumptionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Estados para confirmación de pago
    const [confirmPaymentItem, setConfirmPaymentItem] = useState<ConsumptionItem | null>(null);
    const [receivedAmount, setReceivedAmount] = useState<number>(0);
    const [paymentNotes, setPaymentNotes] = useState("");

    const fetchConsumptions = useCallback(async () => {
        if (!salesOrderId) return;

        setLoading(true);
        const supabase = createClient();

        try {
            const { data, error } = await supabase
                .from('sales_order_items')
                .select(`
                    *,
                    products(name, sku),
                    valet_employee:employees!sales_order_items_delivery_accepted_by_fkey(first_name, last_name)
                `)
                .eq('sales_order_id', salesOrderId)
                .eq('concept_type', 'CONSUMPTION')
                .order('id', { ascending: false });

            if (error) throw error;
            setConsumptions(data || []);
        } catch (error) {
            console.error('Error fetching consumptions:', error);
            toast.error('Error al cargar consumos');
        } finally {
            setLoading(false);
        }
    }, [salesOrderId]);

    useEffect(() => {
        if (isOpen && salesOrderId) {
            fetchConsumptions();
        }
    }, [isOpen, salesOrderId, fetchConsumptions]);

    // Confirmar que el cochero recogió los productos
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

            toast.success('Recogida confirmada', {
                description: `${item.products?.name} - Cochero en camino`
            });

            fetchConsumptions();
        } catch (error) {
            console.error('Error confirming pickup:', error);
            toast.error('Error al confirmar recogida');
        } finally {
            setActionLoading(null);
        }
    };

    // Abrir modal de confirmación de pago
    const openPaymentConfirmation = (item: ConsumptionItem) => {
        const expectedAmount = Number(item.total) + Number(item.tip_amount || 0);
        // Solo sumar propina en efectivo al monto a recibir
        const tipInCash = item.tip_method === 'EFECTIVO' ? Number(item.tip_amount || 0) : 0;
        setReceivedAmount(Number(item.total) + tipInCash);
        setPaymentNotes("");
        setConfirmPaymentItem(item);
    };

    // Confirmar recepción de pago - SOLO TRACKING, el pago ya existe
    const handleConfirmPayment = async () => {
        if (!confirmPaymentItem) return;

        setActionLoading(confirmPaymentItem.id);
        const supabase = createClient();

        try {
            // Solo actualizar campos de tracking
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

            toast.success('Entrega completada', {
                description: `Dinero recibido del cochero: ${formatCurrency(receivedAmount)}`
            });

            setConfirmPaymentItem(null);
            fetchConsumptions();
        } catch (error) {
            console.error('Error confirming payment:', error);
            toast.error('Error al confirmar');
        } finally {
            setActionLoading(null);
        }
    };

    // Reportar problema
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
            fetchConsumptions();
        } catch (error) {
            console.error('Error reporting issue:', error);
            toast.error('Error al reportar problema');
        } finally {
            setActionLoading(null);
        }
    };

    const getValetName = (item: ConsumptionItem) => {
        if (!item.valet_employee) return 'Sin asignar';
        return `${item.valet_employee.first_name} ${item.valet_employee.last_name}`;
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
                    <DialogHeader className="px-6 py-4 border-b">
                        <DialogTitle className="flex items-center gap-2">
                            <ConciergeBell className="h-5 w-5 text-primary" />
                            Servicios y Entregas - Hab. {roomNumber}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto bg-muted/5">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : consumptions.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <ConciergeBell className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                <p>No hay servicios activos</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Producto</TableHead>
                                        <TableHead>Cochero</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {consumptions.map((item) => {
                                        const status = item.delivery_status || 'PENDING_VALET';
                                        const statusConfig = STATUS_CONFIG[status];
                                        const isLoading = actionLoading === item.id;
                                        const totalAmount = Number(item.total) + Number(item.tip_amount || 0);

                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium flex items-center gap-2">
                                                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono text-muted-foreground">
                                                                x{item.qty}
                                                            </span>
                                                            {item.products?.name || 'Producto'}
                                                        </p>
                                                        {item.delivery_notes && (
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                📝 {item.delivery_notes}
                                                            </p>
                                                        )}
                                                        {item.issue_description && (
                                                            <p className="text-xs text-red-500 mt-0.5 font-medium">
                                                                ⚠️ {item.issue_description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-3 w-3 text-muted-foreground" />
                                                        <span className="text-sm">
                                                            {getValetName(item)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`${statusConfig.color} font-normal`}>
                                                        {statusConfig.icon}
                                                        <span className="ml-1.5">{statusConfig.label}</span>
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-medium">{formatCurrency(totalAmount)}</span>
                                                        {Number(item.tip_amount) > 0 && (
                                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <span className="text-[10px]">+</span>
                                                                {formatCurrency(Number(item.tip_amount))} propina
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {status === 'ACCEPTED' && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleConfirmPickup(item)}
                                                                disabled={isLoading}
                                                                className="h-8 bg-purple-600 hover:bg-purple-700 text-white"
                                                            >
                                                                {isLoading ? <Loader2 className="h-3 w-3 animate-spin identity" /> : <Truck className="h-3 w-3 mr-1" />}
                                                                Moto
                                                            </Button>
                                                        )}

                                                        {status === 'DELIVERED' && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => openPaymentConfirmation(item)}
                                                                disabled={isLoading}
                                                                className="h-8 bg-green-600 hover:bg-green-700 text-white"
                                                            >
                                                                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Banknote className="h-3 w-3 mr-1" />}
                                                                Pago
                                                            </Button>
                                                        )}

                                                        {['ACCEPTED', 'IN_TRANSIT', 'DELIVERED'].includes(status) && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuLabel>Opciones</DropdownMenuLabel>
                                                                    <DropdownMenuItem
                                                                        onClick={() => handleReportIssue(item)}
                                                                        className="text-red-600"
                                                                    >
                                                                        <AlertCircle className="mr-2 h-4 w-4" />
                                                                        Reportar Problema
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    <div className="p-4 border-t flex justify-end bg-background">
                        <Button variant="outline" onClick={onClose}>
                            Cerrar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de confirmación de pago */}
            <AlertDialog open={!!confirmPaymentItem} onOpenChange={(open) => !open && setConfirmPaymentItem(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Banknote className="h-5 w-5 text-green-600" />
                            Confirmar Recepción de Pago
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Verifica el monto recibido del cochero
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {confirmPaymentItem && (
                        <div className="space-y-4 py-4">
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Producto:</span>
                                    <span className="font-medium">{confirmPaymentItem.products?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total consumo:</span>
                                    <span>{formatCurrency(Number(confirmPaymentItem.total))}</span>
                                </div>
                                {Number(confirmPaymentItem.tip_amount) > 0 && (
                                    <>
                                        <div className="flex justify-between text-amber-600">
                                            <span>Propina ({confirmPaymentItem.tip_method}):</span>
                                            <span>{formatCurrency(Number(confirmPaymentItem.tip_amount))}</span>
                                        </div>
                                        {confirmPaymentItem.tip_method === 'EFECTIVO' && (
                                            <div className="flex justify-between font-bold border-t pt-2">
                                                <span>Total a recibir:</span>
                                                <span className="text-green-600">
                                                    {formatCurrency(Number(confirmPaymentItem.total) + Number(confirmPaymentItem.tip_amount))}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Monto recibido</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input
                                        type="number"
                                        value={receivedAmount}
                                        onChange={(e) => setReceivedAmount(Number(e.target.value))}
                                        className="pl-7 text-lg"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Notas (opcional)</label>
                                <Textarea
                                    placeholder="Ej: Cochero reportó que cliente estaba satisfecho..."
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                    rows={2}
                                />
                            </div>
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmPayment}
                            className="bg-green-600 hover:bg-green-700"
                            disabled={actionLoading === confirmPaymentItem?.id}
                        >
                            {actionLoading === confirmPaymentItem?.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            Confirmar Pago
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

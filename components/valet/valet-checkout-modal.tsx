"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Room } from "@/components/sales/room-types";
import { formatCurrency } from "@/lib/utils/formatters";
import { CheckCircle2, Clock, DollarSign, AlertTriangle } from "lucide-react";

interface ValetCheckoutModalProps {
    room: Room | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    loading: boolean;
}

export function ValetCheckoutModal({
    room,
    isOpen,
    onClose,
    onConfirm,
    loading
}: ValetCheckoutModalProps) {
    if (!room) return null;

    const activeStay = room.room_stays?.find(s => s.status === 'ACTIVA');
    if (!activeStay) return null;

    // Calcular duración
    const checkinTime = activeStay.check_in_at ? new Date(activeStay.check_in_at) : new Date();
    const now = new Date();
    const durationMs = now.getTime() - checkinTime.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    // Obtener saldo (esto debería venir de sales_order)
    const salesOrder = activeStay.sales_orders;
    const remainingAmount = salesOrder?.remaining_amount ?? 0;
    const hasBalance = remainingAmount > 0;

    const handleConfirm = async () => {
        await onConfirm();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl">
                        Revisión de Salida - Hab. {room.number}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        {room.room_types?.name}
                    </p>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Duración */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-5 w-5 text-blue-500" />
                            <span className="text-sm text-muted-foreground">Duración de estancia</span>
                        </div>
                        <p className="text-2xl font-bold">
                            {hours}h {minutes}m
                        </p>
                    </div>

                    {/* Saldo */}
                    {hasBalance ? (
                        <div className="bg-amber-500/10 border-2 border-amber-500/50 rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                <span className="text-base font-semibold text-amber-200">Saldo Pendiente</span>
                            </div>
                            <p className="text-3xl font-bold text-amber-500">
                                {formatCurrency(remainingAmount)}
                            </p>
                            <p className="text-sm text-amber-100">
                                ⚠️ Cliente debe pasar a recepción para liquidar saldo
                            </p>
                        </div>
                    ) : (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="h-5 w-5 text-green-500" />
                                <span className="text-sm text-muted-foreground">Estado de pago</span>
                            </div>
                            <p className="text-lg font-semibold text-green-500">
                                ✓ Saldo liquidado
                            </p>
                        </div>
                    )}

                    {/* Checklist de revisión */}
                    <div className="border rounded-lg p-4 space-y-3">
                        <p className="font-semibold text-base">Checklist de Revisión</p>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded border-2 flex items-center justify-center">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                                <span>Habitación en orden</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded border-2 flex items-center justify-center">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                                <span>Sin daños o faltantes</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded border-2 flex items-center justify-center">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                                <span>Artículos de baño completos</span>
                            </div>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-sm text-muted-foreground">
                            Al confirmar, notificarás a recepción que la habitación está lista para salida.
                            {hasBalance && ' El cliente debe liquidar el saldo antes de salir.'}
                        </p>
                    </div>

                    {/* Acciones */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                            className="h-12 text-base"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="h-12 text-base bg-blue-600 hover:bg-blue-700"
                        >
                            {loading ? "Confirmando..." : "Confirmar OK"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

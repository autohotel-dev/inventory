"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Clock, Users, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/formatters";
import { MultiPaymentInput } from "@/components/sales/multi-payment-input";

interface ValetExtraChargeModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'EXTRA_HOUR' | 'EXTRA_PERSON';
    room: {
        id: string;
        number: string;
        room_stays: any[];
    } | null;
    employeeId: string;
    onConfirm: (
        salesOrderId: string,
        roomNumber: string,
        amount: number,
        payments: any[],
        valetId: string
    ) => Promise<boolean>;
}

export function ValetExtraChargeModal({
    isOpen,
    onClose,
    type,
    room,
    employeeId,
    onConfirm
}: ValetExtraChargeModalProps) {
    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState<number>(0);
    const [payments, setPayments] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && room) {
            // Valores por defecto sugeridos si existen en la estancia
            const stay = room.room_stays.find((s: any) => s.status === 'ACTIVA');
            const suggestAmount = type === 'EXTRA_HOUR' 
                ? (room as any).room_types?.extra_hour_price || 0
                : (room as any).room_types?.extra_person_price || 0;
            
            setAmount(suggestAmount);
            setPayments([{
                id: crypto.randomUUID(),
                amount: suggestAmount,
                method: 'EFECTIVO',
                reference: ""
            }]);
        }
    }, [isOpen, room, type]);

    const title = type === 'EXTRA_HOUR' ? 'Registrar Hora Extra' : 'Registrar Persona Extra';
    const icon = type === 'EXTRA_HOUR' ? <Clock className="h-6 w-6 text-amber-500" /> : <Users className="h-6 w-6 text-blue-500" />;
    
    const handleConfirm = async () => {
        const stay = room?.room_stays.find((s: any) => s.status === 'ACTIVA');
        if (!stay || !room) return;

        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        if (Math.abs(totalPaid - amount) > 0.01) {
            toast.error(`El monto pagado (${formatCurrency(totalPaid)}) no coincide con el total (${formatCurrency(amount)})`);
            return;
        }

        if (amount <= 0) {
            toast.error("El monto debe ser mayor a 0");
            return;
        }

        setLoading(true);
        try {
            const success = await onConfirm(
                stay.sales_order_id,
                room.number,
                amount,
                payments,
                employeeId
            );
            if (success) onClose();
        } finally {
            setLoading(false);
        }
    };

    if (!room) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        {icon}
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        Habitación {room.number} - Registra el cobro realizado por el cochero.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Monto a Cobrar</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                                id="amount"
                                type="number"
                                value={amount || ""}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setAmount(val);
                                    if (payments.length === 1) {
                                        setPayments(prev => [{ ...prev[0], amount: val }]);
                                    }
                                }}
                                className="pl-7 text-2xl font-bold h-14"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Método de Pago</Label>
                        <MultiPaymentInput
                            totalAmount={amount}
                            payments={payments}
                            onPaymentsChange={setPayments}
                            showReference={true}
                        />
                    </div>

                    <div className="bg-amber-500/10 border-2 border-amber-500/20 rounded-lg p-4">
                        <div className="flex items-start gap-3 text-sm">
                            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-amber-100/80">
                                Esta acción genera un cargo automático en la estancia y registra el pago. 
                                <strong> Debes entregar el dinero/vouchers en recepción.</strong>
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="grid grid-cols-2 gap-3">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleConfirm} 
                        disabled={loading || amount <= 0}
                        className={type === 'EXTRA_HOUR' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Confirmar Cobro
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

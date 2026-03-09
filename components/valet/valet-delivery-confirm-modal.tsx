"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Banknote, CreditCard, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ConsumptionItem {
    id: string;
    qty: number;
    unit_price: number;
    total: number;
    products?: {
        name: string;
        sku?: string;
    } | null;
    sales_orders?: {
        room_stays?: {
            rooms?: {
                number: string;
            };
        };
    };
}

interface ValetDeliveryConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    consumption: ConsumptionItem | null;
    employeeId: string;
    onConfirmed: () => void;
    onConfirmDelivery: (
        consumptionId: string,
        roomNumber: string,
        payments: any[],
        notes: string | undefined,
        valetId: string,
        tipAmount?: number,
        tipMethod?: 'EFECTIVO' | 'TARJETA'
    ) => Promise<boolean>;
}

export function ValetDeliveryConfirmModal({
    isOpen,
    onClose,
    consumption,
    employeeId,
    onConfirmed,
    onConfirmDelivery
}: ValetDeliveryConfirmModalProps) {
    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "TARJETA">("EFECTIVO");
    const [reference, setReference] = useState("");
    const [hasTip, setHasTip] = useState(false);
    const [tipAmount, setTipAmount] = useState<number>(0);
    const [tipMethod, setTipMethod] = useState<"EFECTIVO" | "TARJETA">("EFECTIVO");
    const [notes, setNotes] = useState("");

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setPaymentMethod("EFECTIVO");
            setReference("");
            setHasTip(false);
            setTipAmount(0);
            setTipMethod("EFECTIVO");
            setNotes("");
        }
    }, [isOpen]);

    // room_stays puede ser array o objeto dependiendo de la query
    const roomStays = consumption?.sales_orders?.room_stays;
    const roomStay = Array.isArray(roomStays) ? roomStays[0] : roomStays;
    const roomNumber = roomStay?.rooms?.number || "??";
    const productName = consumption?.products?.name || "Producto";
    const total = Number(consumption?.total || 0);

    const handleConfirm = async () => {
        if (!consumption) return;

        if (paymentMethod === 'TARJETA' && !reference.trim()) {
            toast.error("Ingresa los últimos 4 dígitos del voucher");
            return;
        }

        setLoading(true);
        try {
            const payments = [{
                amount: total,
                method: paymentMethod,
                reference: paymentMethod === 'TARJETA' ? reference.trim() : undefined
            }];

            const success = await onConfirmDelivery(
                consumption.id,
                roomNumber,
                payments,
                notes.trim() || undefined,
                employeeId,
                hasTip ? tipAmount : 0,
                hasTip ? tipMethod : undefined
            );

            if (success) {
                onConfirmed();
                onClose();
            }
        } finally {
            setLoading(false);
        }
    };

    if (!consumption) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                        Informar Entrega a Recepción
                    </DialogTitle>
                    <DialogDescription>
                        Registra los detalles de la entrega para que recepción los valide
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* Info del consumo */}
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Habitación</span>
                            <Badge variant="outline" className="text-lg font-bold bg-white dark:bg-slate-900 px-3">
                                {roomNumber}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Producto</span>
                            <span className="font-semibold text-right">{consumption.qty}x {productName}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                            <span className="font-medium">Total a Cobrar</span>
                            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                                ${total.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Método de Pago */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Método de Pago del Consumo</Label>
                        <RadioGroup
                            value={paymentMethod}
                            onValueChange={(v) => setPaymentMethod(v as any)}
                            className="grid grid-cols-2 gap-2"
                        >
                            <div className={`flex items-center space-x-2 border rounded-lg p-3 cursor-pointer transition-colors ${paymentMethod === 'EFECTIVO' ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                                }`}>
                                <RadioGroupItem value="EFECTIVO" id="p-efectivo" />
                                <Label htmlFor="p-efectivo" className="flex items-center gap-2 cursor-pointer flex-1">
                                    <Banknote className="h-4 w-4 text-green-500" />
                                    <span>Efectivo</span>
                                </Label>
                            </div>

                            <div className={`flex items-center space-x-2 border rounded-lg p-3 cursor-pointer transition-colors ${paymentMethod === 'TARJETA' ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                                }`}>
                                <RadioGroupItem value="TARJETA" id="p-tarjeta" />
                                <Label htmlFor="p-tarjeta" className="flex items-center gap-2 cursor-pointer flex-1">
                                    <CreditCard className="h-4 w-4 text-blue-500" />
                                    <span>Tarjeta</span>
                                </Label>
                            </div>
                        </RadioGroup>

                        {paymentMethod === 'TARJETA' && (
                            <div className="animate-in slide-in-from-top-2 duration-200">
                                <Label htmlFor="ref" className="text-sm text-muted-foreground">Últimos 4 dígitos</Label>
                                <Input
                                    id="ref"
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                    placeholder="1234"
                                    maxLength={4}
                                    className="text-lg"
                                />
                            </div>
                        )}
                    </div>

                    {/* Toggle propina */}
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <div className="space-y-0.5">
                            <Label htmlFor="has-tip" className="font-semibold">Agregar Propina</Label>
                            <p className="text-xs text-muted-foreground">
                                Si el cliente dejó gratificación
                            </p>
                        </div>
                        <Switch
                            id="has-tip"
                            checked={hasTip}
                            onCheckedChange={setHasTip}
                        />
                    </div>

                    {/* Campos de propina */}
                    {hasTip && (
                        <div className="space-y-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg animate-in fade-in duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tip-amount">Monto Propina</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                        <Input
                                            id="tip-amount"
                                            type="number"
                                            value={tipAmount || ""}
                                            onChange={(e) => setTipAmount(Number(e.target.value))}
                                            className="pl-7 text-lg"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Método</Label>
                                    <Select
                                        value={tipMethod}
                                        onValueChange={(v) => setTipMethod(v as "EFECTIVO" | "TARJETA")}
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                                            <SelectItem value="TARJETA">Tarjeta</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notas opcionales */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Observaciones de la entrega</Label>
                        <Textarea
                            id="notes"
                            placeholder="Ej: Se entregó en puerta..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                        />
                    </div>

                    {/* Advertencia final */}
                    <div className="bg-amber-500/10 border-2 border-amber-500/20 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-bold text-amber-200 uppercase tracking-tighter mb-1">Informar a Recepción</p>
                                <p className="text-amber-100/80">
                                    Esta acción informa el cobro a recepción. Debes llevar {paymentMethod === 'EFECTIVO' ? 'el dinero' : 'el voucher'} para que el recepcionista liquide el saldo.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="grid grid-cols-2 gap-3 pt-4 sm:flex sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={onClose} disabled={loading} className="h-12 text-base">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={loading}
                        className="h-12 text-base bg-green-600 hover:bg-green-700"
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        ) : (
                            <CheckCircle2 className="h-5 w-5 mr-2" />
                        )}
                        Informar Cobro a Recepción
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

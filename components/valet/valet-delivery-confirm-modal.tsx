"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
}

export function ValetDeliveryConfirmModal({
    isOpen,
    onClose,
    consumption,
    employeeId,
    onConfirmed
}: ValetDeliveryConfirmModalProps) {
    const [loading, setLoading] = useState(false);
    const [hasTip, setHasTip] = useState(false);
    const [tipAmount, setTipAmount] = useState<number>(0);
    const [tipMethod, setTipMethod] = useState<"EFECTIVO" | "TARJETA">("EFECTIVO");
    const [notes, setNotes] = useState("");

    // room_stays puede ser array o objeto dependiendo de la query
    const roomStays = consumption?.sales_orders?.room_stays;
    const roomStay = Array.isArray(roomStays) ? roomStays[0] : roomStays;
    const roomNumber = roomStay?.rooms?.number || "??";
    const productName = consumption?.products?.name || "Producto";
    const total = Number(consumption?.total || 0);

    const handleConfirmDelivery = async () => {
        if (!consumption) return;

        setLoading(true);
        try {
            const supabase = createClient();

            const updateData: Record<string, any> = {
                delivery_status: 'DELIVERED',
                delivery_completed_at: new Date().toISOString(),
                delivery_notes: notes || null,
            };

            // Solo agregar propina si hay
            if (hasTip && tipAmount > 0) {
                updateData.tip_amount = tipAmount;
                updateData.tip_method = tipMethod;
            }

            const { error } = await supabase
                .from('sales_order_items')
                .update(updateData)
                .eq('id', consumption.id);

            if (error) throw error;

            toast.success("Entrega confirmada", {
                description: `Habitación ${roomNumber} - ${productName}`
            });

            // Limpiar estado
            setHasTip(false);
            setTipAmount(0);
            setTipMethod("EFECTIVO");
            setNotes("");

            onConfirmed();
            onClose();

        } catch (error) {
            console.error("Error confirming delivery:", error);
            toast.error("Error al confirmar la entrega");
        } finally {
            setLoading(false);
        }
    };

    if (!consumption) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        Confirmar Entrega
                    </DialogTitle>
                    <DialogDescription>
                        Confirma que entregaste el consumo al cliente
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Info del consumo */}
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Habitación</span>
                            <Badge variant="outline" className="text-lg font-bold">
                                {roomNumber}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Producto</span>
                            <span className="font-medium">{consumption.qty}x {productName}</span>
                        </div>
                        <div className="flex items-center justify-between border-t pt-2 mt-2">
                            <span className="text-sm font-medium">Total a cobrar</span>
                            <span className="text-xl font-bold text-green-600">
                                ${total.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Toggle propina */}
                    <div className="flex items-center justify-between py-2">
                        <div className="space-y-0.5">
                            <Label htmlFor="has-tip">¿Hubo propina a registrar?</Label>
                            <p className="text-xs text-muted-foreground">
                                Solo si fue con tarjeta o si necesitas dar cambio
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
                        <div className="space-y-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                <Banknote className="h-4 w-4" />
                                <span className="font-medium text-sm">Detalles de propina</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="tip-amount">Monto</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                        <Input
                                            id="tip-amount"
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={tipAmount || ""}
                                            onChange={(e) => setTipAmount(Number(e.target.value))}
                                            className="pl-7"
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
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EFECTIVO">
                                                <div className="flex items-center gap-2">
                                                    <Banknote className="h-4 w-4 text-green-600" />
                                                    Efectivo
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="TARJETA">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard className="h-4 w-4 text-blue-600" />
                                                    Tarjeta
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notas opcionales */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas (opcional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Ej: Cliente pidió más servilletas..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                        />
                    </div>

                    {/* Advertencia */}
                    <div className="flex items-start gap-2 text-xs text-muted-foreground bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>
                            Después de confirmar, debes entregar el dinero en recepción.
                            {hasTip && tipMethod === "EFECTIVO" && tipAmount > 0 && (
                                <strong className="block mt-1 text-amber-600">
                                    Total a entregar: ${(total + tipAmount).toFixed(2)} (incluye propina en efectivo)
                                </strong>
                            )}
                        </span>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmDelivery}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Confirmar Entrega
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

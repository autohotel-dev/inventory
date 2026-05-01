"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Assuming Textarea exists, otherwise Input
import { AlertTriangle, DollarSign } from "lucide-react";
import { Room } from "./room-types";
import { formatCurrency } from "@/lib/utils/formatters"; // Assuming this exists

export interface AddDamageChargeModalProps {
    isOpen: boolean;
    room: Room | null;
    actionLoading: boolean;
    onClose: () => void;
    onConfirm: (amount: number, description: string) => Promise<void>;
}

export function AddDamageChargeModal({
    isOpen,
    room,
    actionLoading,
    onClose,
    onConfirm,
}: AddDamageChargeModalProps) {
    const [amount, setAmount] = useState<string>("");
    const [description, setDescription] = useState<string>("");

    useEffect(() => {
        if (isOpen) {
            setAmount("");
            setDescription("");
        }
    }, [isOpen]);

    if (!isOpen || !room) return null;

    const handleConfirm = async () => {
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) return;
        if (!description.trim()) return;

        await onConfirm(amountNum, description);
    };

    const isValid = !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && description.trim().length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-background border rounded-lg shadow-lg w-[95vw] sm:w-full sm:max-w-md mx-4 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <h2 className="text-lg font-semibold text-red-600">Registrar Daño / Multa</h2>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-red-50 border border-red-100 rounded-md p-3 text-sm text-red-800">
                        Estás registrando un cargo por daños o desperfectos para la <strong>Habitación {room.number}</strong>.
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="damage-amount">Monto a cobrar</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="damage-amount"
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0.00"
                                className="pl-9 text-lg font-bold"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="damage-desc">Descripción del daño / motivo</Label>
                        <Input
                            id="damage-desc"
                            placeholder="Ej. Toalla rota, control remoto perdido..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t flex justify-end gap-2 bg-muted/20">
                    <Button variant="outline" onClick={onClose} disabled={actionLoading}>
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={!isValid || actionLoading}
                    >
                        {actionLoading ? "Registrando..." : "Registrar Cargo"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

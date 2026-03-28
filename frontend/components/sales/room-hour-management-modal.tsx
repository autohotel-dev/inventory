"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, RotateCcw, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { MultiPaymentInput, PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { FOUR_HOUR_PROMO_PRICES } from "@/lib/constants/room-constants";
import { Room } from "./room-types";
import { cn } from "@/lib/utils";

export interface RoomHourManagementModalProps {
    isOpen: boolean;
    room: Room | null;
    actionLoading: boolean;
    onClose: () => void;
    onConfirmCustomHours: (hours: number, isCourtesy?: boolean, courtesyReason?: string) => Promise<void>;
    onConfirmRenew: () => Promise<void>;
    onConfirmPromo4H: () => Promise<void>;
}

type SelectedOption = "custom" | "renew" | "promo4h" | null;

export function RoomHourManagementModal({
    isOpen,
    room,
    actionLoading,
    onClose,
    onConfirmCustomHours,
    onConfirmRenew,
    onConfirmPromo4H,
}: RoomHourManagementModalProps) {
    const [selectedOption, setSelectedOption] = useState<SelectedOption>(null);
    const [customHours, setCustomHours] = useState<string>("1");
    const [isCourtesy, setIsCourtesy] = useState<boolean>(false);
    const [courtesyReason, setCourtesyReason] = useState<string>("");

    // Calcular precio según opción seleccionada
    const calculatePrice = (): number => {
        if (!room?.room_types) return 0;

        switch (selectedOption) {
            case "custom": {
                const hours = parseInt(customHours) || 0;
                if (isCourtesy) return 0;
                const pricePerHour = room.room_types.extra_hour_price || 0;
                return hours * pricePerHour;
            }
            case "renew":
                return room.room_types.base_price || 0;
            case "promo4h": {
                const roomTypeName = room.room_types.name;
                return FOUR_HOUR_PROMO_PRICES[roomTypeName] || 0;
            }
            default:
                return 0;
        }
    };

    const totalPrice = calculatePrice();

    // Reset al abrir/cerrar
    useEffect(() => {
        if (isOpen) {
            setSelectedOption(null);
            setCustomHours("1");
            setIsCourtesy(false);
            setCourtesyReason("");
        }
    }, [isOpen]);

    if (!isOpen || !room) return null;

    const handleConfirm = async () => {
        if (!selectedOption) return;

        switch (selectedOption) {
            case "custom": {
                const hours = parseInt(customHours) || 0;
                if (hours <= 0) {
                    return;
                }
                await onConfirmCustomHours(hours, isCourtesy, courtesyReason);
                break;
            }
            case "renew":
                await onConfirmRenew();
                break;
            case "promo4h":
                await onConfirmPromo4H();
                break;
        }
    };

    const isValidCustomHours = selectedOption === "custom" && parseInt(customHours) > 0;
    const canConfirm =
        !actionLoading &&
        selectedOption !== null &&
        (selectedOption !== "custom" || isValidCustomHours);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div
                id="tour-hour-management-modal"
                className="bg-background border rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
            >
                <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-pink-500" />
                        <h2 className="text-lg font-semibold">Gestionar Horas</h2>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        disabled={actionLoading}
                    >
                        ✕
                    </Button>
                </div>

                <div className="px-6 py-4 space-y-6 overflow-y-auto flex-1">
                    {/* Información de la habitación */}
                    <div className="space-y-1 bg-muted/30 p-3 rounded-lg border border-dashed">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Resumen de Habitación</p>
                        <p className="text-base font-semibold">
                            Hab. {room.number} – {room.room_types?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Precio base: ${room.room_types?.base_price?.toFixed(2)} | Hora extra: ${room.room_types?.extra_hour_price?.toFixed(2)}
                        </p>
                    </div>

                    {/* Opciones */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Selecciona una opción para el cochero:</Label>

                        {/* Opción 1: Horas Personalizadas */}
                        <div
                            id="tour-custom-hours-option"
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedOption === "custom"
                                ? "border-pink-500 bg-pink-500/10 shadow-[0_0_15px_-5px_rgba(236,72,153,0.3)]"
                                : "border-border hover:border-pink-500/50"
                                }`}
                            onClick={() => setSelectedOption("custom")}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-full ${selectedOption === "custom" ? "bg-pink-500 text-white" : "bg-muted text-muted-foreground"}`}>
                                    <Clock className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-sm mb-1 uppercase tracking-tight">Horas Personalizadas</h3>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Solicitar cobro de horas adicionales al cochero.
                                    </p>
                                    {selectedOption === "custom" && (
                                        <div className="space-y-3 pt-2">
                                            <div className="flex items-center gap-3">
                                                <div className="space-y-1 flex-1">
                                                    <Label className="text-[10px] text-muted-foreground uppercase">Cantidad de Horas</Label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        max="24"
                                                        value={customHours}
                                                        onChange={(e) => setCustomHours(e.target.value)}
                                                        className="w-full h-10 text-lg font-bold"
                                                        placeholder="Horas"
                                                    />
                                                </div>
                                                <div className="pt-5 text-muted-foreground flex flex-col items-center">
                                                    <span className="text-xs font-bold">=</span>
                                                </div>
                                                <div className="space-y-1 flex-1 bg-black/20 p-2 rounded border border-white/5">
                                                    <Label className="text-[10px] text-muted-foreground uppercase">Monto a Cobrar</Label>
                                                    <p className="text-lg font-black text-pink-400">
                                                        {isCourtesy ? "$0.00" : `$${totalPrice.toFixed(2)}`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="pt-2 space-y-3 border-t border-pink-500/20">
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <Label htmlFor="courtesy-mode" className="text-sm font-bold">MODO CORTESÍA</Label>
                                                        <p className="text-[10px] text-muted-foreground">No genera cobro para el cochero</p>
                                                    </div>
                                                    <Switch
                                                        id="courtesy-mode"
                                                        checked={isCourtesy}
                                                        onCheckedChange={setIsCourtesy}
                                                    />
                                                </div>

                                                {isCourtesy && (
                                                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 bg-black/30 p-2 rounded border border-yellow-500/20">
                                                        <Label htmlFor="courtesy-reason" className="text-[10px] text-yellow-500 font-bold uppercase">Motivo de la Cortesía</Label>
                                                        <Input
                                                            id="courtesy-reason"
                                                            placeholder="Ej. Compensación por demora..."
                                                            value={courtesyReason}
                                                            onChange={(e) => setCourtesyReason(e.target.value)}
                                                            className="h-9 text-sm italic"
                                                            autoFocus
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Opción 2: Renovar */}
                        <div
                            id="tour-renew-option"
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedOption === "renew"
                                ? "border-blue-500 bg-blue-500/10 shadow-[0_0_15px_-5px_rgba(59,130,246,0.3)]"
                                : "border-border hover:border-blue-500/50"
                                }`}
                            onClick={() => setSelectedOption("renew")}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-full ${selectedOption === "renew" ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"}`}>
                                    <RotateCcw className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-sm mb-1 uppercase tracking-tight">Renovar Habitación</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Renueva estancia con precio base original.
                                    </p>
                                    {selectedOption === "renew" && (
                                        <div className="mt-3 bg-black/20 p-2 rounded border border-blue-500/20 flex flex-col items-center">
                                            <Label className="text-[10px] text-muted-foreground uppercase mb-1">Monto a Cobrar por Cochero</Label>
                                            <p className="text-xl font-black text-blue-400">
                                                ${totalPrice.toFixed(2)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Opción 3: Promoción 4 Horas */}
                        <div
                            id="tour-promo4h-option"
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedOption === "promo4h"
                                ? "border-amber-500 bg-amber-500/10 shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)]"
                                : "border-border hover:border-amber-500/50"
                                }`}
                            onClick={() => setSelectedOption("promo4h")}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-full ${selectedOption === "promo4h" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`}>
                                    <Zap className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-sm mb-1 flex items-center gap-2 uppercase tracking-tight">
                                        Promoción 4 Horas
                                        <span className="text-[10px] bg-amber-500 text-black font-black px-2 py-0.5 rounded leading-none">
                                            OFERTA
                                        </span>
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Extiende 4 horas con precio especial.
                                    </p>
                                    {selectedOption === "promo4h" && (
                                        <div className="mt-3 bg-black/20 p-2 rounded border border-amber-500/20 flex flex-col items-center">
                                            <Label className="text-[10px] text-muted-foreground uppercase mb-1">Monto Promocional por Cochero</Label>
                                            <p className="text-xl font-black text-amber-400">
                                                ${totalPrice.toFixed(2)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-500/10 p-3 rounded border border-blue-500/30">
                        <div className="flex gap-2 text-blue-400">
                            <Zap className="h-4 w-4 shrink-0 mt-0.5" />
                            <p className="text-xs italic">
                                Al confirmar, el sistema registrará la solicitud y enviará una notificación automática al cochero para que realice el cobro correspondiente.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t bg-muted/20 flex justify-end gap-2 flex-shrink-0">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={actionLoading}
                        className="font-bold uppercase text-xs"
                    >
                        Cancelar
                    </Button>
                    <Button
                        id="tour-confirm-button"
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                        className={cn(
                            "font-black uppercase tracking-widest px-8",
                            selectedOption === "custom"
                                ? "bg-pink-600 hover:bg-pink-700"
                                : selectedOption === "renew"
                                    ? "bg-blue-600 hover:bg-blue-700"
                                    : selectedOption === "promo4h"
                                        ? "bg-amber-600 hover:bg-amber-700"
                                        : ""
                        )}
                    >
                        {actionLoading
                            ? "Procesando Solicitud..."
                            : selectedOption
                                ? `SOLICITAR COBRO $${totalPrice.toFixed(2)}`
                                : "Selecciona una opción"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

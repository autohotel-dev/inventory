"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, RotateCcw, Zap } from "lucide-react";
import { MultiPaymentInput, PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { FOUR_HOUR_PROMO_PRICES } from "@/lib/constants/room-constants";
import { Room } from "./room-types";

export interface RoomHourManagementModalProps {
    isOpen: boolean;
    room: Room | null;
    actionLoading: boolean;
    onClose: () => void;
    onConfirmCustomHours: (hours: number, payments: PaymentEntry[]) => Promise<void>;
    onConfirmRenew: (payments: PaymentEntry[]) => Promise<void>;
    onConfirmPromo4H: (payments: PaymentEntry[]) => Promise<void>;
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
    const [payments, setPayments] = useState<PaymentEntry[]>([]);

    // Calcular precio según opción seleccionada
    const calculatePrice = (): number => {
        if (!room?.room_types) return 0;

        switch (selectedOption) {
            case "custom": {
                const hours = parseInt(customHours) || 0;
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

    // Actualizar payments cuando cambia el precio o la opción
    useEffect(() => {
        if (selectedOption && totalPrice > 0) {
            setPayments(createInitialPayment(totalPrice));
        }
    }, [selectedOption, totalPrice]);

    // Reset al abrir/cerrar
    useEffect(() => {
        if (isOpen) {
            setSelectedOption(null);
            setCustomHours("1");
            setPayments([]);
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
                await onConfirmCustomHours(hours, payments);
                break;
            }
            case "renew":
                await onConfirmRenew(payments);
                break;
            case "promo4h":
                await onConfirmPromo4H(payments);
                break;
        }
    };

    const isValidCustomHours = selectedOption === "custom" && parseInt(customHours) > 0;
    const canConfirm =
        !actionLoading &&
        selectedOption !== null &&
        (selectedOption !== "custom" || isValidCustomHours) &&
        payments.reduce((s, p) => s + p.amount, 0) > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-background border rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
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

                <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
                    {/* Información de la habitación */}
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Habitación</p>
                        <p className="text-base font-semibold">
                            Hab. {room.number} – {room.room_types?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Precio base: ${room.room_types?.base_price?.toFixed(2)} | Hora extra: ${room.room_types?.extra_hour_price?.toFixed(2)}
                        </p>
                    </div>

                    {/* Opciones */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Selecciona una opción:</Label>

                        {/* Opción 1: Horas Personalizadas */}
                        <div
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedOption === "custom"
                                    ? "border-pink-500 bg-pink-500/10"
                                    : "border-border hover:border-pink-500/50"
                                }`}
                            onClick={() => setSelectedOption("custom")}
                        >
                            <div className="flex items-start gap-3">
                                <Clock className="h-5 w-5 text-pink-400 mt-0.5" />
                                <div className="flex-1">
                                    <h3 className="font-semibold text-sm mb-1">Horas Personalizadas</h3>
                                    <p className="text-xs text-muted-foreground mb-2">
                                        Agrega el número de horas que necesites
                                    </p>
                                    {selectedOption === "custom" && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="24"
                                                    value={customHours}
                                                    onChange={(e) => setCustomHours(e.target.value)}
                                                    className="w-24"
                                                    placeholder="Horas"
                                                />
                                                <span className="text-sm text-muted-foreground">
                                                    × ${room.room_types?.extra_hour_price?.toFixed(2)} = ${totalPrice.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Opción 2: Renovar */}
                        <div
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedOption === "renew"
                                    ? "border-blue-500 bg-blue-500/10"
                                    : "border-border hover:border-blue-500/50"
                                }`}
                            onClick={() => setSelectedOption("renew")}
                        >
                            <div className="flex items-start gap-3">
                                <RotateCcw className="h-5 w-5 text-blue-400 mt-0.5" />
                                <div className="flex-1">
                                    <h3 className="font-semibold text-sm mb-1">Renovar Habitación</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Renueva con el precio base original
                                    </p>
                                    {selectedOption === "renew" && (
                                        <p className="text-sm font-semibold text-blue-400 mt-2">
                                            Precio: ${totalPrice.toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Opción 3: Promoción 4 Horas */}
                        <div
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedOption === "promo4h"
                                    ? "border-amber-500 bg-amber-500/10"
                                    : "border-border hover:border-amber-500/50"
                                }`}
                            onClick={() => setSelectedOption("promo4h")}
                        >
                            <div className="flex items-start gap-3">
                                <Zap className="h-5 w-5 text-amber-400 mt-0.5" />
                                <div className="flex-1">
                                    <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
                                        Promoción 4 Horas
                                        <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                                            ¡Oferta!
                                        </span>
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Extiende 4 horas con precio especial
                                    </p>
                                    {selectedOption === "promo4h" && (
                                        <p className="text-sm font-semibold text-amber-400 mt-2">
                                            Precio promocional: ${totalPrice.toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Multi-payment input cuando hay opción seleccionada */}
                    {selectedOption && totalPrice > 0 && (
                        <div className="pt-4 border-t">
                            <MultiPaymentInput
                                totalAmount={totalPrice}
                                payments={payments}
                                onPaymentsChange={setPayments}
                                disabled={actionLoading}
                            />
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t flex justify-end gap-2 flex-shrink-0">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={actionLoading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                        className={
                            selectedOption === "custom"
                                ? "bg-pink-600 hover:bg-pink-700"
                                : selectedOption === "renew"
                                    ? "bg-blue-600 hover:bg-blue-700"
                                    : selectedOption === "promo4h"
                                        ? "bg-amber-600 hover:bg-amber-700"
                                        : ""
                        }
                    >
                        {actionLoading
                            ? "Procesando..."
                            : selectedOption
                                ? `Confirmar $${payments.reduce((s, p) => s + p.amount, 0).toFixed(2)}`
                                : "Selecciona una opción"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

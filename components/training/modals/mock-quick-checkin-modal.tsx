"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoomType } from "@/components/sales/room-types";
import {
    Minus,
    Plus,
    Users,
    Car,
    Clock,
    Zap,
    AlertTriangle,
    UserCog
} from "lucide-react";
import { mockValets } from "@/lib/training/mock-data";

export interface VehicleInfo {
    plate: string;
    brand: string;
    model: string;
}

export interface MockQuickCheckinModalProps {
    isOpen: boolean;
    roomNumber: string;
    roomType: RoomType;
    actionLoading: boolean;
    onClose: () => void;
    onConfirm: (data: {
        initialPeople: number;
        vehicle: VehicleInfo;
        actualEntryTime: Date;
        valetEmployeeId?: string | null;
    }) => void;
}

function formatTime(date: Date) {
    return date.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDateTime(date: Date) {
    return date.toLocaleString("es-MX", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function MockQuickCheckinModal({
    isOpen,
    roomNumber,
    roomType,
    actionLoading,
    onClose,
    onConfirm,
}: MockQuickCheckinModalProps) {
    const [initialPeople, setInitialPeople] = useState(2);
    const [vehicle, setVehicle] = useState<VehicleInfo>({ plate: "", brand: "", model: "" });
    const [useCustomTime, setUseCustomTime] = useState(false);
    const [customHour, setCustomHour] = useState("");
    const [customMinute, setCustomMinute] = useState("");
    const [valetEmployeeId, setValetEmployeeId] = useState<string>("");
    const [valets, setValets] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);

    const maxPeople = roomType?.max_people ?? 4;
    const extraPersonPrice = roomType?.extra_person_price ?? 0;
    const extraPeopleCount = Math.max(0, initialPeople - 2);
    const extraPeopleCost = extraPeopleCount * extraPersonPrice;
    const totalPrice = (roomType?.base_price ?? 0) + extraPeopleCost;

    // Cargar valets simulados
    useEffect(() => {
        if (isOpen) {
            setValets(mockValets);
        }
    }, [isOpen]);

    // Calcular hora de salida estimada
    const getExpectedCheckout = (entryTime: Date) => {
        const isWeekend = entryTime.getDay() === 0 || entryTime.getDay() === 6;
        const hours = isWeekend
            ? (roomType?.weekend_hours ?? 4)
            : (roomType?.weekday_hours ?? 4);
        const checkout = new Date(entryTime);
        checkout.setHours(checkout.getHours() + hours);
        return checkout;
    };

    // Calcular la hora de entrada real
    const getActualEntryTime = (): Date => {
        if (!useCustomTime) {
            return new Date();
        }

        const now = new Date();
        const entryDate = new Date(now);

        if (customHour && customMinute) {
            entryDate.setHours(parseInt(customHour));
            entryDate.setMinutes(parseInt(customMinute));

            // Si la hora es futura, asumir que fue ayer (ej: son las 2am y ponen entrada a las 11pm)
            if (entryDate > now) {
                entryDate.setDate(entryDate.getDate() - 1);
            }
        }

        return entryDate;
    };

    const actualEntryTime = getActualEntryTime();
    const expectedCheckout = getExpectedCheckout(actualEntryTime);

    // Inicializar tiempo custom con hora actual
    useEffect(() => {
        if (isOpen) {
            const now = new Date();
            setCustomHour(now.getHours().toString().padStart(2, '0'));
            setCustomMinute(now.getMinutes().toString().padStart(2, '0'));
            setInitialPeople(2);
            setVehicle({ plate: "", brand: "", model: "" });
            setValetEmployeeId("");
            setUseCustomTime(false);
        }
    }, [isOpen]);


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        <h2 className="text-lg font-semibold">Entrada Rápida (Práctica)</h2>
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
                    {/* Info Habitación */}
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Habitación</p>
                        <p className="text-base font-semibold">
                            Hab. {roomNumber} – {roomType.name}
                        </p>
                    </div>

                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div className="text-sm text-amber-900 dark:text-amber-100">
                            <p className="font-medium">Modo Entrada Rápida</p>
                            <p className="text-xs opacity-90">
                                Usa este modo cuando el cliente ya ingresó pero el valet aún no trae el pago.
                                La cuenta quedará pendiente de cobro.
                            </p>
                        </div>
                    </div>

                    {/* Selector de personas */}
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Personas que entran
                        </p>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setInitialPeople(Math.max(1, initialPeople - 1))}
                                disabled={actionLoading || initialPeople <= 1}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <span className="text-2xl font-bold w-12 text-center">{initialPeople}</span>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setInitialPeople(Math.min(maxPeople, initialPeople + 1))}
                                disabled={actionLoading || initialPeople >= maxPeople}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {extraPeopleCount > 0 && (
                            <p className="text-xs text-amber-600 font-medium ml-1">
                                +${extraPeopleCost} por personas extra
                            </p>
                        )}
                    </div>

                    {/* Hora de entrada manual */}
                    <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Hora de entrada
                            </p>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="useCustomTime"
                                    checked={useCustomTime}
                                    onChange={(e) => setUseCustomTime(e.target.checked)}
                                    className="rounded border-gray-300"
                                />
                                <label htmlFor="useCustomTime" className="text-xs text-muted-foreground cursor-pointer">
                                    Ajustar hora
                                </label>
                            </div>
                        </div>

                        {useCustomTime ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    min="0"
                                    max="23"
                                    value={customHour}
                                    onChange={(e) => {
                                        let val = parseInt(e.target.value);
                                        if (val > 23) val = 23;
                                        if (val < 0) val = 0;
                                        setCustomHour(val.toString().padStart(2, '0'));
                                    }}
                                    className="w-16 text-center"
                                />
                                <span className="text-xl font-bold">:</span>
                                <Input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={customMinute}
                                    onChange={(e) => {
                                        let val = parseInt(e.target.value);
                                        if (val > 59) val = 59;
                                        if (val < 0) val = 0;
                                        setCustomMinute(val.toString().padStart(2, '0'));
                                    }}
                                    className="w-16 text-center"
                                />
                            </div>
                        ) : (
                            <p className="text-sm font-medium pl-6">
                                Ahora ({formatTime(new Date())})
                            </p>
                        )}
                    </div>

                    {/* Asignar Cochero */}
                    <div className="space-y-2 pt-2 border-t">
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <UserCog className="h-4 w-4" />
                            Cochero (Opcional)
                        </p>
                        <Select value={valetEmployeeId} onValueChange={setValetEmployeeId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar cochero..." />
                            </SelectTrigger>
                            <SelectContent>
                                {valets.map(valet => (
                                    <SelectItem key={valet.id} value={valet.id}>
                                        {valet.first_name} {valet.last_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Vehículo (Simplificado para Quick Check-in) */}
                    <div className="space-y-2 pt-2 border-t">
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Car className="h-4 w-4" />
                            Placas (Opcional)
                        </p>
                        <Input
                            placeholder="ABC-123"
                            value={vehicle.plate}
                            onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value.toUpperCase() })}
                            className="uppercase"
                        />
                    </div>

                    {/* Resumen */}
                    <div className="mt-4 p-3 bg-muted rounded-lg space-y-1">
                        <div className="flex justify-between text-sm">
                            <span>Precio Base:</span>
                            <span>${roomType?.base_price}</span>
                        </div>
                        {extraPeopleCost > 0 && (
                            <div className="flex justify-between text-sm text-amber-600">
                                <span>Extras:</span>
                                <span>+${extraPeopleCost}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold border-t border-gray-300 pt-1 mt-1">
                            <span>Total a Cobrar:</span>
                            <span>${totalPrice}</span>
                        </div>
                        <div className="text-xs text-muted-foreground text-right pt-1">
                            Salida estimada: {formatTime(expectedCheckout)}
                        </div>
                    </div>

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
                        onClick={() => onConfirm({
                            initialPeople,
                            vehicle,
                            actualEntryTime,
                            valetEmployeeId: valetEmployeeId || null
                        })}
                        disabled={actionLoading}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                        {actionLoading ? "Registrando..." : "Registrar Entrada Rápida"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

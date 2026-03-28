"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RoomType } from "@/components/sales/room-types";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/export-utils"; // FIX #9: Use centralized date formatter
import {
  Minus,
  Plus,
  Users,
  Clock,
  Zap,
  AlertTriangle,
  DollarSign,
} from "lucide-react";

export interface QuickCheckinModalProps {
  isOpen: boolean;
  roomNumber: string;
  roomType: RoomType;
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: (data: {
    initialPeople: number;
    actualEntryTime: Date;
    durationNights: number;
  }) => void;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// FIX #9: Removed local formatDateTime - using centralized utility from export-utils

export function QuickCheckinModal({
  isOpen,
  roomNumber,
  roomType,
  actionLoading,
  onClose,
  onConfirm,
}: QuickCheckinModalProps) {
  const [initialPeople, setInitialPeople] = useState(1);
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customHour, setCustomHour] = useState("");
  const [customMinute, setCustomMinute] = useState("");

  const [durationNights, setDurationNights] = useState(1);

  const maxPeople = roomType?.max_people ?? 4;
  const extraPersonPrice = roomType?.extra_person_price ?? 0;
  const extraPeopleCount = Math.max(0, initialPeople - 2);
  const extraPeopleCost = extraPeopleCount * extraPersonPrice;
  const basePricePerNight = (roomType?.base_price ?? 0) + extraPeopleCost;
  const totalPrice = roomType?.is_hotel ? (basePricePerNight * durationNights) : basePricePerNight;

  // Calcular hora de salida estimada
  const getExpectedCheckout = (entryTime: Date) => {
    if (roomType?.is_hotel) {
      const checkout = new Date(entryTime);
      checkout.setDate(checkout.getDate() + durationNights);
      checkout.setHours(12, 0, 0, 0); // Check-out estándar de hotel a las 12 PM
      return checkout;
    }

    // Determinar si estamos en período de fin de semana (Viernes 6am - Domingo 6am)
    const day = entryTime.getDay();
    const hour = entryTime.getHours();
    let isWeekendPeriod = false;

    if (day === 5 && hour >= 6) {
      isWeekendPeriod = true;
    } else if (day === 6) {
      isWeekendPeriod = true;
    } else if (day === 0 && hour < 6) {
      isWeekendPeriod = true;
    }

    const hours = isWeekendPeriod
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
    const hour = parseInt(customHour) || now.getHours();
    const minute = parseInt(customMinute) || now.getMinutes();

    const entryTime = new Date();
    entryTime.setHours(hour, minute, 0, 0);

    // Si la hora es mayor que ahora, asumir que fue ayer
    if (entryTime > now) {
      entryTime.setDate(entryTime.getDate() - 1);
    }

    return entryTime;
  };

  const actualEntryTime = getActualEntryTime();
  const expectedCheckout = getExpectedCheckout(actualEntryTime);
  const timeDifference = Math.round((new Date().getTime() - actualEntryTime.getTime()) / 60000);



  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setInitialPeople(1);
      setDurationNights(1);
      setUseCustomTime(false);
      const now = new Date();
      setCustomHour(now.getHours().toString().padStart(2, "0"));
      setCustomMinute(now.getMinutes().toString().padStart(2, "0"));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({
      initialPeople,
      actualEntryTime,
      durationNights,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        id="tour-quick-checkin-modal"
        className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Entrada Rápida</h2>
          </div>
          <Badge variant="secondary" className="text-xs">
            Pago pendiente
          </Badge>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Alerta informativa */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-500">Entrada sin pago</p>
                <p className="text-muted-foreground text-xs mt-1">
                  La habitación quedará ocupada con pago pendiente.
                  Podrás registrar el pago cuando el cochero llegue con el dinero.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Habitación {roomNumber}</p>
            <p className="text-base font-semibold">
              Hab. {roomNumber} – {roomType.name}
            </p>
          </div>

          {/* Selector de Noches (Solo para Hotel) */}
          {roomType.is_hotel && (
            <div className="space-y-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Duración de la estancia
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDurationNights(Math.max(1, durationNights - 1))}
                  disabled={actionLoading || durationNights <= 1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-xl font-bold w-20 text-center">{durationNights} {durationNights === 1 ? 'Noche' : 'Noches'}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDurationNights(Math.min(30, durationNights + 1))}
                  disabled={actionLoading}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Hora de entrada */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hora de entrada real
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUseCustomTime(!useCustomTime)}
                className="text-xs"
              >
                {useCustomTime ? "Usar hora actual" : "Ajustar hora"}
              </Button>
            </div>

            {useCustomTime ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={customHour}
                  onChange={(e) => setCustomHour(e.target.value)}
                  className="w-20 text-center"
                  placeholder="HH"
                />
                <span className="text-xl font-bold">:</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={customMinute}
                  onChange={(e) => setCustomMinute(e.target.value)}
                  className="w-20 text-center"
                  placeholder="MM"
                />
                {timeDifference > 0 && (
                  <Badge variant="outline" className="text-xs">
                    hace {timeDifference} min
                  </Badge>
                )}
              </div>
            ) : (
              <p className="text-base font-semibold">
                {formatTime(new Date())} (ahora)
              </p>
            )}
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
              <span className="text-sm text-muted-foreground">
                (máx. {maxPeople})
              </span>
            </div>
          </div>

          {/* Resumen de precio */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Total a cobrar</span>
              </div>
              <span className="text-lg font-semibold">
                ${totalPrice.toFixed(2)} MXN
              </span>
            </div>
            {extraPeopleCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Base: ${roomType.base_price?.toFixed(2)} + {extraPeopleCount} persona(s) extra: ${extraPeopleCost.toFixed(2)}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Salida estimada</p>
            <p className="text-base font-medium">
              {formatDateTime(expectedCheckout)}
            </p>
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
            onClick={handleConfirm}
            disabled={actionLoading}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {actionLoading ? "Registrando..." : "Registrar Entrada"}
          </Button>
        </div>
      </div>
    </div>
  );
}

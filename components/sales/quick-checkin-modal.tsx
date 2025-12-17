"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RoomType } from "@/components/sales/room-types";
import { 
  Minus, 
  Plus, 
  Users, 
  Car, 
  Clock, 
  Zap,
  AlertTriangle,
  DollarSign
} from "lucide-react";

export interface VehicleInfo {
  plate: string;
  brand: string;
  model: string;
}

export interface QuickCheckinModalProps {
  isOpen: boolean;
  roomNumber: string;
  roomType: RoomType;
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: (data: {
    initialPeople: number;
    vehicle: VehicleInfo;
    actualEntryTime: Date;
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

export function QuickCheckinModal({
  isOpen,
  roomNumber,
  roomType,
  actionLoading,
  onClose,
  onConfirm,
}: QuickCheckinModalProps) {
  const [initialPeople, setInitialPeople] = useState(2);
  const [vehicle, setVehicle] = useState<VehicleInfo>({ plate: "", brand: "", model: "" });
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customHour, setCustomHour] = useState("");
  const [customMinute, setCustomMinute] = useState("");
  
  const maxPeople = roomType?.max_people ?? 4;
  const extraPersonPrice = roomType?.extra_person_price ?? 0;
  const extraPeopleCount = Math.max(0, initialPeople - 2);
  const extraPeopleCost = extraPeopleCount * extraPersonPrice;
  const totalPrice = (roomType?.base_price ?? 0) + extraPeopleCost;

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
      setInitialPeople(2);
      setVehicle({ plate: "", brand: "", model: "" });
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
      vehicle,
      actualEntryTime,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
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

          {/* Información del vehículo */}
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Car className="h-4 w-4" />
              Datos del vehículo (opcional)
            </p>
            <div className="grid grid-cols-1 gap-3">
              <Input
                placeholder="Placas (ej: ABC-123)"
                value={vehicle.plate}
                onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value.toUpperCase() })}
                disabled={actionLoading}
                className="uppercase"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Marca"
                  value={vehicle.brand}
                  onChange={(e) => setVehicle({ ...vehicle, brand: e.target.value })}
                  disabled={actionLoading}
                />
                <Input
                  placeholder="Modelo"
                  value={vehicle.model}
                  onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                  disabled={actionLoading}
                />
              </div>
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

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, X, Clock, RotateCcw, AlertTriangle } from "lucide-react";
import { Room, RoomType } from "@/components/sales/room-types";

interface ChangeRoomModalProps {
  isOpen: boolean;
  currentRoom: Room | null;
  currentStay: {
    id: string;
    check_in_at: string;
    expected_check_out_at: string;
    current_people: number;
    vehicle_plate?: string | null;
    vehicle_brand?: string | null;
    vehicle_model?: string | null;
    sales_order_id: string;
  } | null;
  availableRooms: Room[]; // Solo habitaciones LIBRES
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: (data: {
    newRoomId: string;
    keepTime: boolean; // true = mantener tiempo, false = reiniciar
    reason: string;
    priceDifference: number;
  }) => void;
}

export function ChangeRoomModal({
  isOpen,
  currentRoom,
  currentStay,
  availableRooms,
  actionLoading,
  onClose,
  onConfirm,
}: ChangeRoomModalProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [timeOption, setTimeOption] = useState<"keep" | "reset">("keep");
  const [reason, setReason] = useState("");

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setSelectedRoomId("");
      setTimeOption("keep");
      setReason("");
    }
  }, [isOpen]);

  if (!isOpen || !currentRoom || !currentStay) return null;

  // Calcular tiempo transcurrido
  const checkInTime = new Date(currentStay.check_in_at);
  const now = new Date();
  const elapsedMinutes = Math.floor((now.getTime() - checkInTime.getTime()) / 60000);
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const elapsedMins = elapsedMinutes % 60;

  // Calcular hora de salida según opción
  const expectedCheckout = new Date(currentStay.expected_check_out_at);
  const currentRoomType = currentRoom.room_types;
  
  // Para reinicio, calcular nueva hora de salida
  const getNewCheckoutTime = (roomType: RoomType | null) => {
    if (!roomType) return new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const hours = isWeekend ? (roomType.weekend_hours ?? 4) : (roomType.weekday_hours ?? 4);
    const newCheckout = new Date(now);
    newCheckout.setHours(newCheckout.getHours() + hours);
    return newCheckout;
  };

  // Habitación seleccionada
  const selectedRoom = availableRooms.find(r => r.id === selectedRoomId);
  const selectedRoomType = selectedRoom?.room_types;

  // Calcular diferencia de precio
  const currentPrice = currentRoomType?.base_price ?? 0;
  const newPrice = selectedRoomType?.base_price ?? 0;
  const priceDifference = newPrice - currentPrice;

  // Hora de salida según opción
  const checkoutIfKeep = expectedCheckout;
  const checkoutIfReset = selectedRoomType ? getNewCheckoutTime(selectedRoomType) : new Date();

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  };

  const handleConfirm = () => {
    if (!selectedRoomId || !reason.trim()) return;
    onConfirm({
      newRoomId: selectedRoomId,
      keepTime: timeOption === "keep",
      reason: reason.trim(),
      priceDifference,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <ArrowRightLeft className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Cambiar Habitación
              </h2>
              <p className="text-sm text-muted-foreground">
                Hab. {currentRoom.number} ({currentRoomType?.name || "---"})
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tiempo transcurrido */}
        <div className="bg-muted/50 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-muted-foreground">Tiempo transcurrido:</span>
            <span className="font-bold">
              {elapsedHours > 0 ? `${elapsedHours}h ` : ""}{elapsedMins} min
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Entrada: {formatTime(checkInTime)} → Salida esperada: {formatTime(expectedCheckout)}
          </div>
        </div>

        {/* Selección de nueva habitación */}
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Nueva habitación</Label>
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar habitación disponible" />
              </SelectTrigger>
              <SelectContent>
                {availableRooms.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    No hay habitaciones disponibles
                  </div>
                ) : (
                  availableRooms.map((room) => (
                    <SelectItem 
                      key={room.id} 
                      value={room.id}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-bold">{room.number}</span>
                        <span className="text-muted-foreground">-</span>
                        <span>{room.room_types?.name || "---"}</span>
                        <span className="text-emerald-500 ml-2">
                          ${room.room_types?.base_price?.toFixed(0) || 0}
                        </span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Opción de tiempo */}
          {selectedRoomId && (
            <div className="bg-muted/30 rounded-lg p-4">
              <Label className="text-muted-foreground mb-3 block">¿Qué hacer con el tiempo?</Label>
              <RadioGroup value={timeOption} onValueChange={(v: string) => setTimeOption(v as "keep" | "reset")}>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 rounded-lg border hover:border-blue-500/50 cursor-pointer transition-colors">
                    <RadioGroupItem value="keep" id="keep" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-400" />
                        <span className="font-medium">Mantener tiempo</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        El cliente conserva el tiempo que ya llevaba. 
                        Salida: <span className="text-blue-400 font-medium">{formatTime(checkoutIfKeep)}</span>
                      </p>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 p-3 rounded-lg border hover:border-emerald-500/50 cursor-pointer transition-colors">
                    <RadioGroupItem value="reset" id="reset" className="mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-emerald-400" />
                        <span className="font-medium">Reiniciar tiempo</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        El tiempo comienza desde cero. 
                        Salida: <span className="text-emerald-400 font-medium">{formatTime(checkoutIfReset)}</span>
                      </p>
                    </div>
                  </label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Diferencia de precio */}
          {selectedRoomId && priceDifference !== 0 && (
            <div className={`rounded-lg p-3 ${priceDifference > 0 ? "bg-amber-500/10 border border-amber-500/30" : "bg-emerald-500/10 border border-emerald-500/30"}`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${priceDifference > 0 ? "text-amber-400" : "text-emerald-400"}`} />
                <span className="text-sm">
                  {priceDifference > 0 ? (
                    <>Cobrar diferencia: <span className="font-bold text-amber-400">+${priceDifference.toFixed(2)}</span></>
                  ) : (
                    <>Devolver diferencia: <span className="font-bold text-emerald-400">${Math.abs(priceDifference).toFixed(2)}</span></>
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {currentRoomType?.name} (${currentPrice}) → {selectedRoomType?.name} (${newPrice})
              </p>
            </div>
          )}

          {/* Motivo */}
          <div>
            <Label htmlFor="reason" className="text-muted-foreground">
              Motivo del cambio <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Problema con el A/C, solicitud del cliente, error de asignación..."
              className="mt-1 min-h-[80px]"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={actionLoading || !selectedRoomId || !reason.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {actionLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span> Cambiando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" /> Confirmar Cambio
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RoomType } from "@/components/sales/room-types";
import { Minus, Plus, Users } from "lucide-react";

export interface RoomStartStayModalProps {
  isOpen: boolean;
  roomNumber: string;
  roomType: RoomType;
  expectedCheckout: Date;
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: (initialPeople: number) => void;
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

export function RoomStartStayModal({
  isOpen,
  roomNumber,
  roomType,
  expectedCheckout,
  actionLoading,
  onClose,
  onConfirm,
}: RoomStartStayModalProps) {
  const [initialPeople, setInitialPeople] = useState(2);
  const maxPeople = roomType?.max_people ?? 4;
  const extraPersonPrice = roomType?.extra_person_price ?? 0;

  // Calcular costo extra por personas adicionales
  const extraPeopleCount = Math.max(0, initialPeople - 2);
  const extraPeopleCost = extraPeopleCount * extraPersonPrice;
  const totalPrice = (roomType?.base_price ?? 0) + extraPeopleCost;

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setInitialPeople(2);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Iniciar estancia</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={actionLoading}
          >
            ✕
          </Button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Habitación</p>
            <p className="text-base font-semibold">
              Hab. {roomNumber} – {roomType.name}
            </p>
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
            {extraPeopleCount > 0 && (
              <p className="text-sm text-amber-500">
                +{extraPeopleCount} persona{extraPeopleCount > 1 ? 's' : ''} extra = +${extraPeopleCost.toFixed(2)} MXN
              </p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Precio base</p>
            <p className="text-base font-semibold">
              $ {roomType.base_price?.toFixed(2) ?? "0.00"} MXN
            </p>
          </div>

          {extraPeopleCost > 0 && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total inicial</p>
              <p className="text-lg font-bold text-emerald-500">
                $ {totalPrice.toFixed(2)} MXN
              </p>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Salida estimada</p>
            <p className="text-base font-medium">
              {formatDateTime(expectedCheckout)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Se creará una orden de venta en estado "Abierta" vinculada a esta habitación.
          </p>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={actionLoading}
          >
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(initialPeople)} disabled={actionLoading}>
            {actionLoading ? "Iniciando..." : "Iniciar estancia"}
          </Button>
        </div>
      </div>
    </div>
  );
}

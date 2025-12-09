"use client";

import { Button } from "@/components/ui/button";
import { RoomType } from "@/components/sales/room-types";

export interface RoomStartStayModalProps {
  isOpen: boolean;
  roomNumber: string;
  roomType: RoomType;
  expectedCheckout: Date;
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Precio base</p>
            <p className="text-base font-semibold">
              $ {roomType.base_price?.toFixed(2) ?? "0.00"} MXN
            </p>
          </div>
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
          <Button onClick={onConfirm} disabled={actionLoading}>
            {actionLoading ? "Iniciando..." : "Iniciar estancia"}
          </Button>
        </div>
      </div>
    </div>
  );
}

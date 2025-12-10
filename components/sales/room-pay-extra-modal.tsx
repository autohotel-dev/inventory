"use client";

import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";

export interface RoomPayExtraModalProps {
  isOpen: boolean;
  roomNumber: string;
  roomTypeName: string;
  extraAmount: number;
  payAmount: number;
  actionLoading: boolean;
  onAmountChange: (amount: number) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function RoomPayExtraModal({
  isOpen,
  roomNumber,
  roomTypeName,
  extraAmount,
  payAmount,
  actionLoading,
  onAmountChange,
  onClose,
  onConfirm,
}: RoomPayExtraModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Pagar Extras</h2>
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
        <div className="px-6 py-4 space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Habitación</p>
            <p className="text-base font-semibold">
              Hab. {roomNumber} – {roomTypeName}
            </p>
          </div>
          
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-200">
              Este pago es solo para los cargos extra (personas u horas adicionales). 
              La habitación seguirá ocupada.
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Cargos extra pendientes</p>
            <p className="text-2xl font-bold text-yellow-400">
              ${extraAmount.toFixed(2)} MXN
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Monto a pagar</p>
            <input
              type="number"
              min={0}
              max={extraAmount}
              step="0.01"
              value={payAmount}
              onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
              className="w-full border rounded px-3 py-2 bg-background text-lg font-semibold"
            />
            {payAmount < extraAmount && (
              <p className="text-xs text-amber-400">
                Quedará un saldo pendiente de ${(extraAmount - payAmount).toFixed(2)} MXN
              </p>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={actionLoading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={actionLoading || payAmount <= 0}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            {actionLoading ? "Procesando..." : `Pagar $${payAmount.toFixed(2)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

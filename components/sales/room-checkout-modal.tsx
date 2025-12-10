"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PaymentMethod, PAYMENT_METHODS } from "@/components/sales/room-types";

export interface RoomCheckoutModalProps {
  isOpen: boolean;
  roomNumber: string;
  roomTypeName: string;
  remainingAmount: number;
  checkoutAmount: number;
  actionLoading: boolean;
  onAmountChange: (amount: number) => void;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod) => void;
}

export function RoomCheckoutModal({
  isOpen,
  roomNumber,
  roomTypeName,
  remainingAmount,
  checkoutAmount,
  actionLoading,
  onAmountChange,
  onClose,
  onConfirm,
}: RoomCheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('EFECTIVO');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cobrar / Check-out</h2>
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
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Saldo pendiente</p>
            <p className="text-base font-semibold">
              {remainingAmount.toFixed(2)} MXN
            </p>
          </div>
          {remainingAmount > 0 && (
            <>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Monto a cobrar ahora</p>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={checkoutAmount}
                  onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
                  className="w-full border rounded px-3 py-2 bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Deja el monto igual al saldo pendiente para hacer el check-out completo.
                </p>
              </div>

              {/* Selector de método de pago */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Método de pago</p>
                <div className="flex gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <Button
                      key={method.value}
                      type="button"
                      variant={paymentMethod === method.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod(method.value)}
                      disabled={actionLoading}
                      className="flex-1"
                    >
                      <span className="mr-1">{method.icon}</span>
                      {method.label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={actionLoading}
          >
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(paymentMethod)} disabled={actionLoading}>
            {actionLoading
              ? "Procesando..."
              : remainingAmount <= 0
                ? "Dar salida"
                : "Confirmar pago"}
          </Button>
        </div>
      </div>
    </div>
  );
}

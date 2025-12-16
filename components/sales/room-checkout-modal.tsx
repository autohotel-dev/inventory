"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PaymentMethod } from "@/components/sales/room-types";
import { MultiPaymentInput, PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";

export interface RoomCheckoutModalProps {
  isOpen: boolean;
  roomNumber: string;
  roomTypeName: string;
  remainingAmount: number;
  checkoutAmount: number;
  actionLoading: boolean;
  onAmountChange: (amount: number) => void;
  onClose: () => void;
  onConfirm: (payments: PaymentEntry[]) => void;
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
  const [payments, setPayments] = useState<PaymentEntry[]>([]);

  // Reset al abrir
  useEffect(() => {
    if (isOpen && remainingAmount > 0) {
      setPayments(createInitialPayment(remainingAmount));
    }
  }, [isOpen, remainingAmount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
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
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
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
            <MultiPaymentInput
              totalAmount={remainingAmount}
              payments={payments}
              onPaymentsChange={setPayments}
              disabled={actionLoading}
            />
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
          <Button onClick={() => onConfirm(payments)} disabled={actionLoading || (remainingAmount > 0 && payments.reduce((s, p) => s + p.amount, 0) <= 0)}>
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

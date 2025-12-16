"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { PaymentMethod, PAYMENT_METHODS, PaymentTerminal, PAYMENT_TERMINALS } from "@/components/sales/room-types";

export interface PaymentEntry {
  id: string;
  amount: number;
  method: PaymentMethod;
  terminal?: PaymentTerminal; // Solo aplica cuando method = 'TARJETA'
  reference?: string;
}

interface MultiPaymentInputProps {
  totalAmount: number;
  payments: PaymentEntry[];
  onPaymentsChange: (payments: PaymentEntry[]) => void;
  disabled?: boolean;
  showReference?: boolean;
}

export function MultiPaymentInput({
  totalAmount,
  payments,
  onPaymentsChange,
  disabled = false,
  showReference = false,
}: MultiPaymentInputProps) {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalAmount - totalPaid;

  const addPayment = () => {
    const newPayment: PaymentEntry = {
      id: crypto.randomUUID(),
      amount: remaining > 0 ? remaining : 0,
      method: "EFECTIVO",
      terminal: undefined,
      reference: "",
    };
    onPaymentsChange([...payments, newPayment]);
  };

  const updatePayment = (id: string, field: keyof PaymentEntry, value: any) => {
    onPaymentsChange(
      payments.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, [field]: field === "amount" ? parseFloat(value) || 0 : value };
        // Si cambia a EFECTIVO, limpiar terminal
        if (field === "method" && value === "EFECTIVO") {
          updated.terminal = undefined;
        }
        // Si cambia a TARJETA y no tiene terminal, asignar BBVA por defecto
        if (field === "method" && value === "TARJETA" && !updated.terminal) {
          updated.terminal = "BBVA";
        }
        return updated;
      })
    );
  };

  const removePayment = (id: string) => {
    onPaymentsChange(payments.filter((p) => p.id !== id));
  };

  const getMethodIcon = (method: PaymentMethod) => {
    const found = PAYMENT_METHODS.find((m) => m.value === method);
    return found?.icon || "💰";
  };

  return (
    <div className="space-y-3">
      {/* Lista de pagos - scrolleable */}
      <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
        {payments.map((payment, index) => (
        <div
          key={payment.id}
          className="p-3 rounded-lg border bg-muted/30 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Pago #{index + 1}
            </span>
            {payments.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-400"
                onClick={() => removePayment(payment.id)}
                disabled={disabled}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Método de pago */}
          <div className="flex gap-1">
            {PAYMENT_METHODS.map((method) => (
              <Button
                key={method.value}
                type="button"
                variant={payment.method === method.value ? "default" : "outline"}
                size="sm"
                onClick={() => updatePayment(payment.id, "method", method.value)}
                disabled={disabled}
                className="flex-1 text-xs px-2"
              >
                <span className="mr-1">{method.icon}</span>
                {method.label}
              </Button>
            ))}
          </div>

          {/* Selector de terminal (solo para tarjeta) */}
          {payment.method === "TARJETA" && (
            <div className="flex gap-1">
              {PAYMENT_TERMINALS.map((terminal) => (
                <Button
                  key={terminal.value}
                  type="button"
                  variant={payment.terminal === terminal.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => updatePayment(payment.id, "terminal", terminal.value)}
                  disabled={disabled}
                  className={`flex-1 text-xs px-2 ${payment.terminal === terminal.value ? terminal.color + " text-white" : ""}`}
                >
                  {terminal.label}
                </Button>
              ))}
            </div>
          )}

          {/* Monto */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={payment.amount || ""}
                onChange={(e) => updatePayment(payment.id, "amount", e.target.value)}
                disabled={disabled}
                placeholder="Monto"
                className="h-9"
              />
            </div>
            {showReference && (
              <div className="flex-1">
                <Input
                  type="text"
                  value={payment.reference || ""}
                  onChange={(e) => updatePayment(payment.id, "reference", e.target.value)}
                  disabled={disabled}
                  placeholder="Referencia (opcional)"
                  className="h-9"
                />
              </div>
            )}
          </div>
        </div>
        ))}
      </div>

      {/* Botón agregar pago */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addPayment}
        disabled={disabled}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Agregar otro método de pago
      </Button>

      {/* Resumen */}
      <div className="p-3 rounded-lg bg-muted/50 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total a pagar:</span>
          <span className="font-medium">${totalAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total pagado:</span>
          <span className={`font-medium ${totalPaid >= totalAmount ? "text-emerald-500" : ""}`}>
            ${totalPaid.toFixed(2)}
          </span>
        </div>
        {remaining > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Restante:</span>
            <span className="font-medium text-amber-500">${remaining.toFixed(2)}</span>
          </div>
        )}
        {remaining < 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Cambio:</span>
            <span className="font-medium text-blue-500">${Math.abs(remaining).toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Desglose por método */}
      {payments.length > 1 && (
        <div className="text-xs text-muted-foreground space-y-1">
          {PAYMENT_METHODS.map((method) => {
            const methodTotal = payments
              .filter((p) => p.method === method.value)
              .reduce((sum, p) => sum + p.amount, 0);
            if (methodTotal === 0) return null;
            return (
              <div key={method.value} className="flex justify-between">
                <span>{method.icon} {method.label}:</span>
                <span>${methodTotal.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Función helper para inicializar pagos
export function createInitialPayment(
  amount: number, 
  method: PaymentMethod = "EFECTIVO",
  terminal?: PaymentTerminal
): PaymentEntry[] {
  return [
    {
      id: crypto.randomUUID(),
      amount,
      method,
      terminal: method === "TARJETA" ? (terminal || "BBVA") : undefined,
      reference: "",
    },
  ];
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { PaymentMethod, PAYMENT_METHODS, PaymentTerminal, PAYMENT_TERMINALS, CardType, CARD_TYPES } from "@/components/sales/room-types";

export interface PaymentEntry {
  id: string;
  amount: number;
  method: PaymentMethod;
  terminal?: PaymentTerminal;
  reference?: string;
  cardLast4?: string;
  cardType?: CardType;
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
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set(payments.map(p => p.id)));
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalAmount - totalPaid;
  const isComplete = totalPaid >= totalAmount;

  const toggleExpanded = (id: string) => {
    setExpandedPayments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addPayment = () => {
    const newPayment: PaymentEntry = {
      id: crypto.randomUUID(),
      amount: remaining > 0 ? remaining : 0,
      method: "EFECTIVO",
      terminal: undefined,
      reference: "",
      cardLast4: undefined,
      cardType: undefined,
    };
    onPaymentsChange([...payments, newPayment]);
    setExpandedPayments(prev => new Set([...prev, newPayment.id]));
  };

  const updatePayment = (id: string, field: keyof PaymentEntry, value: any) => {
    onPaymentsChange(
      payments.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, [field]: field === "amount" ? parseFloat(value) || 0 : value };
        if (field === "method" && value === "EFECTIVO") {
          updated.terminal = undefined;
          updated.cardLast4 = undefined;
          updated.cardType = undefined;
        }
        if (field === "method" && value === "TARJETA" && !updated.terminal) {
          updated.terminal = "BBVA";
        }
        return updated;
      })
    );
  };

  const removePayment = (id: string) => {
    onPaymentsChange(payments.filter((p) => p.id !== id));
    setExpandedPayments(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Resumen compacto */}
      <div className={`grid grid-cols-3 gap-2 p-3 rounded-lg border ${isComplete ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500' :
        remaining > 0 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-400' :
          'bg-muted border-border'
        }`}>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold">${totalAmount.toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Pagado</p>
          <p className={`text-lg font-bold ${isComplete ? 'text-emerald-600' : ''}`}>
            ${totalPaid.toFixed(2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">{remaining > 0 ? 'Falta' : 'Cambio'}</p>
          <p className={`text-lg font-bold ${remaining > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
            ${Math.abs(remaining).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Lista de pagos compacta */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {payments.map((payment, index) => {
          const isExpanded = expandedPayments.has(payment.id);
          return (
            <div key={payment.id} className="border rounded-lg bg-card">
              {/* Header compacto clickeable */}
              <button
                type="button"
                onClick={() => toggleExpanded(payment.id)}
                className="w-full p-2 flex items-center justify-between hover:bg-muted/50 rounded-t-lg transition-colors"
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-semibold">#{index + 1}</span>
                  <span className="text-lg">{payment.method === "EFECTIVO" ? "💵" : "💳"}</span>
                  <span className="text-sm">{PAYMENT_METHODS.find(m => m.value === payment.method)?.label}</span>
                  {payment.amount > 0 && (
                    <span className="text-sm font-bold text-primary ml-auto mr-2">
                      ${payment.amount.toFixed(2)}
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {/* Detalles expandibles */}
              {isExpanded && (
                <div className="p-3 pt-2 space-y-2 border-t">
                  {/* Monto y método en una fila */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs mb-1">Monto</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payment.amount || ""}
                        onChange={(e) => updatePayment(payment.id, "amount", e.target.value)}
                        disabled={disabled}
                        placeholder="0.00"
                        className="h-9 font-semibold"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1">Método</Label>
                      <div className="grid grid-cols-2 gap-1">
                        {PAYMENT_METHODS.map((method) => (
                          <Button
                            key={method.value}
                            type="button"
                            variant={payment.method === method.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => updatePayment(payment.id, "method", method.value)}
                            disabled={disabled}
                            className="h-9 text-xs px-1"
                          >
                            {method.icon}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Detalles de tarjeta */}
                  {payment.method === "TARJETA" && (
                    <div className="space-y-2 pt-1">
                      {/* Terminales */}
                      <div className="grid grid-cols-2 gap-1">
                        {PAYMENT_TERMINALS.map((terminal) => (
                          <Button
                            key={terminal.value}
                            type="button"
                            variant={payment.terminal === terminal.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => updatePayment(payment.id, "terminal", terminal.value)}
                            disabled={disabled}
                            className={`h-8 text-xs ${payment.terminal === terminal.value ? terminal.color + " text-white" : ""
                              }`}
                          >
                            {terminal.label}
                          </Button>
                        ))}
                      </div>

                      {/* Últimos 4 y tipo */}
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="text"
                          maxLength={4}
                          value={payment.cardLast4 || ""}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            updatePayment(payment.id, "cardLast4", value);
                          }}
                          disabled={disabled}
                          placeholder="Últimos 4"
                          className="h-8 text-center text-sm"
                        />
                        <div className="grid grid-cols-2 gap-1">
                          {CARD_TYPES.map((cardType) => (
                            <Button
                              key={cardType.value}
                              type="button"
                              variant={payment.cardType === cardType.value ? "default" : "outline"}
                              size="sm"
                              onClick={() => updatePayment(payment.id, "cardType", cardType.value)}
                              disabled={disabled}
                              className="h-8 text-[10px] px-1 flex flex-col items-center justify-center gap-0"
                            >
                              <span className="text-xs">{cardType.icon}</span>
                              <span className="leading-none">{cardType.label}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botón eliminar */}
                  {payments.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePayment(payment.id)}
                      disabled={disabled}
                      className="w-full h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Eliminar
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botón agregar */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addPayment}
        disabled={disabled}
        className="w-full border-dashed"
      >
        <Plus className="h-4 w-4 mr-1" />
        Agregar pago
      </Button>
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
      cardLast4: undefined,
      cardType: undefined,
    },
  ];
}

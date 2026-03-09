"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-2">
      {/* Resumen compacto */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-md border ${isComplete ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30' :
        remaining > 0 ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-400/30' :
          'bg-muted/50 border-border'
        }`}>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Total</span>
          <span className="text-sm font-bold">${totalAmount.toFixed(2)}</span>
        </div>

        {remaining !== 0 && (
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">{remaining > 0 ? 'Falta' : 'Cambio'}</span>
            <span className={`text-sm font-bold ${remaining > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
              ${Math.abs(remaining).toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Pagado</span>
          <span className={`text-sm font-bold ${isComplete ? 'text-emerald-600' : ''}`}>
            ${totalPaid.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Grid de pagos */}
      <div className="grid grid-cols-4 gap-2 max-h-[450px] overflow-y-auto">
        {payments.map((payment, index) => {
          const isExpanded = expandedPayments.has(payment.id);
          return (
            <div
              key={payment.id}
              className={cn(
                "border rounded-md bg-card shadow-sm hover:border-primary/20 transition-all",
                isExpanded ? "col-span-4" : "col-span-1"
              )}
            >
              {/* Header: Si está colapsado es Grid Cell, si expandido es Header de Form */}
              <div
                className={cn(
                  "cursor-pointer group relative",
                  isExpanded ? "flex items-center p-2 gap-2" : "flex flex-col items-center justify-center p-2 gap-1 h-full min-h-[80px]"
                )}
                onClick={() => toggleExpanded(payment.id)}
              >
                {/* Index Badge */}
                <div className={cn(
                  "flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary",
                  isExpanded ? "w-6 h-6 text-xs" : "absolute top-1 left-1 w-5 h-5 text-[10px]"
                )}>
                  {index + 1}
                </div>

                {/* Contenido Principal */}
                {isExpanded ? (
                  // Header Expandido
                  <div className="flex-1 grid grid-cols-[1fr,auto] gap-2 items-center">
                    <span className="text-xs font-semibold text-primary pl-1">
                      {payment.method} - ${payment.amount.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  // Celda Colapsada (Mini Card)
                  <>
                    <div className="mb-1">
                      {payment.method === 'EFECTIVO' ? (
                        <span className="text-xl">💵</span>
                      ) : (
                        <span className="text-xl">💳</span>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none mb-0.5">{payment.method}</p>
                      <p className="text-xs font-bold text-foreground">
                        ${payment.amount.toFixed(2)}
                      </p>
                    </div>
                  </>
                )}

                {/* Actions (Solo si expandido o hover en celda?) -> Mejor solo en expandido o esquina */}
                {payments.length > 1 && isExpanded && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-red-500 ml-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePayment(payment.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Formulario expandido */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-0 space-y-3 border-t mt-1 pt-3">
                  <div className="grid grid-cols-[1fr,1.5fr] gap-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Monto</Label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={payment.amount || ""}
                          onChange={(e) => updatePayment(payment.id, "amount", e.target.value)}
                          disabled={disabled}
                          className="h-9 pl-5 text-sm font-bold bg-muted/20"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Método</Label>
                      <div className="flex gap-1.5 h-9">
                        {PAYMENT_METHODS.map((method) => (
                          <button
                            key={method.value}
                            type="button"
                            onClick={() => updatePayment(payment.id, "method", method.value)}
                            disabled={disabled}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border text-[10px] font-medium transition-all
                                ${payment.method === method.value
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : 'bg-background hover:bg-muted text-muted-foreground border-input'}`}
                          >
                            <span>{method.icon}</span>
                            <span>{method.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Detalles Compuestos de Tarjeta */}
                  {payment.method === "TARJETA" && (
                    <div className="p-2.5 bg-muted/40 rounded-md border border-dashed border-border/60 space-y-2.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[10px] text-muted-foreground mb-1 block">Terminal</Label>
                          <div className="flex gap-1">
                            {PAYMENT_TERMINALS.map((t) => (
                              <button
                                key={t.value}
                                type="button"
                                onClick={() => updatePayment(payment.id, "terminal", t.value)}
                                className={`flex-1 h-7 rounded text-[9px] font-medium border transition-colors
                                                ${payment.terminal === t.value
                                    ? (t.value === 'BBVA' ? 'bg-blue-600 text-white border-blue-600' : 'bg-red-600 text-white border-red-600')
                                    : 'bg-background hover:bg-muted text-muted-foreground'}`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground mb-1 block">Tipo</Label>
                          <div className="flex gap-1">
                            {CARD_TYPES.map((ct) => (
                              <button
                                key={ct.value}
                                type="button"
                                onClick={() => updatePayment(payment.id, "cardType", ct.value)}
                                className={`flex-1 h-7 rounded text-[9px] font-medium border flex items-center justify-center gap-1 transition-colors
                                                ${payment.cardType === ct.value
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-muted text-muted-foreground'}`}
                              >
                                {ct.icon} {ct.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Últimos 4 Dígitos:</Label>
                        <Input
                          maxLength={4}
                          value={payment.cardLast4 || ""}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            updatePayment(payment.id, "cardLast4", val);
                          }}
                          className="h-7 w-24 text-center text-xs tracking-widest font-mono bg-background"
                          placeholder="0000"
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="flex justify-end pt-1">
                    {payments.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
                        onClick={() => removePayment(payment.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1.5" />
                        Eliminar Pago
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Botón agregar como tarjeta del grid */}
        <button
          type="button"
          onClick={addPayment}
          disabled={disabled}
          className="flex flex-col items-center justify-center gap-1 min-h-[80px] rounded-md border border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all text-muted-foreground hover:text-primary col-span-1"
        >
          <Plus className="h-5 w-5" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Agregar</span>
        </button>
      </div>
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

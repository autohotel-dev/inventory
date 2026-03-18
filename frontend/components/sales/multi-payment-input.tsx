"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { PaymentMethod, PAYMENT_METHODS, PaymentTerminal, PAYMENT_TERMINALS, CardType, CARD_TYPES } from "@/components/sales/room-types";
import { formatCurrency } from "./payment/utils";

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
    <div className="space-y-4">
      {/* Resumen Premium */}
      <div className={cn(
        "grid grid-cols-3 gap-3 p-3 rounded-2xl border backdrop-blur-sm transition-all duration-500",
        isComplete 
          ? "bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_-10px_rgba(16,185,129,0.2)]" 
          : remaining > 0 
            ? "bg-amber-500/5 border-amber-500/20 shadow-[0_0_20px_-10px_rgba(245,158,11,0.2)]"
            : "bg-zinc-900/40 border-zinc-800"
      )}>
        <div className="flex flex-col items-center justify-center border-r border-white/5 last:border-0 px-2">
          <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1 opacity-60">Total</span>
          <span className="text-sm font-black text-foreground">{formatCurrency(totalAmount)}</span>
        </div>

        <div className="flex flex-col items-center justify-center border-r border-white/5 last:border-0 px-2">
          <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1 opacity-60">
            {remaining > 0 ? 'Falta' : 'Cambio'}
          </span>
          <span className={cn(
            "text-sm font-black",
            remaining > 0 ? "text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]" : "text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]"
          )}>
            {formatCurrency(Math.abs(remaining))}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center last:border-0 px-2">
          <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1 opacity-60">Pagado</span>
          <span className={cn(
            "text-sm font-black",
            isComplete ? "text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "text-foreground"
          )}>
            {formatCurrency(totalPaid)}
          </span>
        </div>
      </div>

      {/* Grid de pagos */}
      <div className="grid grid-cols-2 gap-3 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
        {payments.map((payment, index) => {
          const isExpanded = expandedPayments.has(payment.id);
          return (
            <div
              key={payment.id}
              className={cn(
                "group border rounded-2xl bg-zinc-900/40 backdrop-blur-sm transition-all duration-300",
                isExpanded ? "col-span-2 border-primary/30 shadow-[0_0_15px_-5px_rgba(var(--primary),0.2)]" : "col-span-1 border-white/5 hover:border-white/10"
              )}
            >
              {/* Header */}
              <div
                className={cn(
                  "cursor-pointer flex items-center p-3 gap-3",
                  !isExpanded && "justify-between"
                )}
                onClick={() => toggleExpanded(payment.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 font-black text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                    {index + 1}
                  </div>
                  {!isExpanded && (
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">
                        {payment.method}
                      </span>
                      <span className="text-sm font-black text-foreground">
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <span className="text-xs font-black text-primary uppercase tracking-widest">
                    Editando Pago {index + 1}
                  </span>
                )}

                <div className="ml-auto flex items-center gap-2">
                  {payments.length > 1 && isExpanded && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePayment(payment.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground opacity-50" />}
                </div>
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

"use client";

import { MultiPaymentInput, PaymentEntry } from "@/components/sales/multi-payment-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "./utils";

interface PaymentStepViewProps {
  selectedTotal: number;
  tipAmount: number;
  payments: PaymentEntry[];
  setPayments: (payments: PaymentEntry[]) => void;
  setTipAmount: (amount: number) => void;
}

export function PaymentStepView({
  selectedTotal,
  tipAmount,
  payments,
  setPayments,
  setTipAmount,
}: PaymentStepViewProps) {
  const totalToPay = selectedTotal + tipAmount;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col items-center justify-center py-4 bg-primary/5 rounded-xl border border-primary/10">
        <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Total a cobrar</p>
        <p className="text-4xl font-black text-primary tracking-tighter">
          {formatCurrency(totalToPay)}
        </p>
        {tipAmount > 0 && (
          <p className="text-xs text-green-600 font-bold mt-1">
            Incluye {formatCurrency(tipAmount)} de propina
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Subtotal Conceptos</Label>
            <div className="p-3 bg-muted/50 rounded-lg font-mono text-sm border border-border/50">
              {formatCurrency(selectedTotal)}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tip" className="text-xs uppercase font-bold text-muted-foreground">Propina (Opcional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="tip"
                type="number"
                placeholder="0.00"
                className="pl-7"
                value={tipAmount || ""}
                onChange={(e) => setTipAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs uppercase font-bold text-muted-foreground">Método de Pago</Label>
          <MultiPaymentInput
            totalAmount={totalToPay}
            payments={payments}
            onPaymentsChange={(newPayments) => setPayments(newPayments)}
          />
        </div>
      </div>
    </div>
  );
}

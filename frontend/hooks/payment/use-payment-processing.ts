"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { OrderItem } from "../use-granular-payment";

interface UsePaymentProcessingProps {
  salesOrderId: string;
  items: OrderItem[];
  selectedItems: Set<string>;
  discounts: Record<string, number>;
  onComplete?: () => void;
  onRefreshItems: () => void;
}

export function usePaymentProcessing({
  salesOrderId,
  items,
  selectedItems,
  discounts,
  onComplete,
  onRefreshItems
}: UsePaymentProcessingProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>(createInitialPayment(0));
  const [tipAmount, setTipAmount] = useState(0);
  const [processing, setProcessing] = useState(false);

  const selectedTotal = items
    .filter(i => selectedItems.has(i.id))
    .reduce((sum, i) => sum + (i.total - (discounts[i.id] || 0)), 0);

  const pendingTotal = items
    .filter(i => !i.is_paid)
    .reduce((sum, i) => sum + (i.total - (discounts[i.id] || 0)), 0);

  const processPayment = async () => {
    const totalToPay = selectedTotal + tipAmount;
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

    if (Math.abs(totalPayments - totalToPay) > 0.01) {
      toast.error(`Los pagos (${totalPayments}) no coinciden con el total (${totalToPay})`);
      return;
    }

    try {
      setProcessing(true);
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user session");

      const paymentItems = Array.from(selectedItems).map(id => {
        const item = items.find(i => i.id === id);
        return {
          id,
          discount: discounts[id] || 0,
          total: item?.total || 0
        };
      });

      const { error } = await supabase.rpc("process_granular_payment", {
        p_sales_order_id: salesOrderId,
        p_items: paymentItems,
        p_payments: payments,
        p_tip_amount: tipAmount,
        p_processed_by: user.id
      });

      if (error) throw error;

      toast.success("Pago procesado correctamente");
      onRefreshItems();
      onComplete?.();
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error("Error al procesar el pago");
    } finally {
      setProcessing(false);
    }
  };

  const getPaymentInfo = (item: OrderItem) => {
    if (!item.is_paid) return null;
    return {
      method: item.payment_method || "N/A",
      paidAt: item.paid_at
    };
  };

  return {
    payments,
    tipAmount,
    processing,
    selectedTotal,
    pendingTotal,
    processPayment,
    getPaymentInfo,
    setPayments,
    setTipAmount
  };
}

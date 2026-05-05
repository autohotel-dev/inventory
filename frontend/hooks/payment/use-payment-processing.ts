"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { OrderItem } from "@/components/sales/payment/payment-constants";
import { findActiveFlow, logFlowEvent } from "@/lib/flow-logger";
import { apiClient } from "@/lib/api/client";

interface UsePaymentProcessingProps {
  salesOrderId: string;
  items: OrderItem[];
  selectedItems: Set<string>;
  discounts: Record<string, number>;
  onComplete?: () => void;
  onRefreshItems: () => void;
  roomNumber?: string;
}

export function usePaymentProcessing({
  salesOrderId,
  items,
  selectedItems,
  discounts,
  onComplete,
  onRefreshItems,
  roomNumber
}: UsePaymentProcessingProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>(createInitialPayment(0));
  const [tipAmount, setTipAmount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const processingLockRef = useRef(false);

  const selectedTotal = items
    .filter(i => selectedItems.has(i.id) && !i.is_paid)
    .reduce((sum, i) => sum + (i.total - (discounts[i.id] || 0)), 0);

  const pendingTotal = items
    .filter(i => !i.is_paid)
    .reduce((sum, i) => sum + (i.total - (discounts[i.id] || 0)), 0);

  const processPayment = async () => {
    if (processingLockRef.current) return;
    const totalToPay = selectedTotal + tipAmount;
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

    if (Math.abs(totalPayments - totalToPay) > 0.01) {
      toast.error(`Los pagos (${totalPayments}) no coinciden con el total (${totalToPay})`);
      return;
    }

    try {
      processingLockRef.current = true;
      setProcessing(true);

      const validPayments = payments.filter(p => p.amount > 0).map(p => ({
        amount: p.amount,
        method: p.method,
        terminal: p.terminal,
        reference: p.reference,
        cardLast4: p.cardLast4,
        cardType: p.cardType,
        collected_by: p.collected_by,
        original_payment_id: p.original_payment_id
      }));

      // Procesar pagos a través del BFF (FastAPI)
      const payload = {
        item_ids: Array.from(selectedItems),
        payments: validPayments,
        tip_amount: tipAmount,
        room_number: roomNumber
      };

      await apiClient.post(`/sales/orders/${salesOrderId}/process`, payload);

      toast.success("Pago procesado correctamente");

      // ─── Flow Event ─────────────────────────────────────────────
      try {
        const { data: stayForFlow } = await apiClient.get(`/rooms/stays/by_order/${salesOrderId}`);
        if (stayForFlow?.id) {
          findActiveFlow(stayForFlow.id).then(flowId => {
            if (flowId) {
              logFlowEvent(flowId, {
                event_type: "PAYMENT_CONFIRMED",
                description: `Pago procesado por recepción: $${selectedTotal.toFixed(2)} (${validPayments.map(p => p.method).join(', ')})`,
                metadata: {
                  amount: selectedTotal,
                  payment_count: validPayments.length,
                  methods: validPayments.map(p => ({ method: p.method, amount: p.amount })),
                  tip: tipAmount > 0 ? tipAmount : undefined,
                },
              });
            }
          });
        }
      } catch (flowErr) {
        console.error("[flow-logger] payment:", flowErr);
      }

      // Imprimir comprobante de pago
      try {
        const PRINT_SERVER_URL = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';
        const conceptLabels: Record<string, string> = {
          ROOM_BASE: 'Habitación', EXTRA_HOUR: 'Hora Extra', EXTRA_PERSON: 'Persona Extra',
          CONSUMPTION: 'Consumo', PRODUCT: 'Producto', RENEWAL: 'Renovación',
        };
        const paidItems = items
          .filter(i => selectedItems.has(i.id) && !i.is_paid)
          .map(i => ({
            name: i.products?.name || conceptLabels[i.concept_type] || i.concept_type,
            qty: i.qty || 1,
            total: i.total - (discounts[i.id] || 0)
          }));
        const methodsSummary = validPayments.map(p => p.method).join(', ');

        const paymentDetails = validPayments.map(p => ({
          method: p.method,
          amount: p.amount,
          terminal: p.terminal || undefined,
          cardLast4: p.cardLast4 || undefined,
          cardType: p.cardType || undefined,
          reference: p.reference || undefined,
        }));

        fetch(`${PRINT_SERVER_URL}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'payment',
            data: {
              roomNumber: roomNumber || undefined,
              date: new Date(),
              items: paidItems,
              total: selectedTotal,
              paymentMethod: methodsSummary,
              paymentDetails,
              tipAmount: tipAmount > 0 ? tipAmount : undefined,
            }
          })
        }).catch(err => console.error('Print payment ticket error (non-blocking):', err));
      } catch (printErr) {
        console.error('Error preparing payment print:', printErr);
      }

      setPayments(createInitialPayment(0));
      setTipAmount(0);
      onRefreshItems();
      onComplete?.();
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error("Error al procesar el pago");
    } finally {
      setProcessing(false);
      processingLockRef.current = false;
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

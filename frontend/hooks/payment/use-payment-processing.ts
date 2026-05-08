"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { OrderItem } from "@/components/sales/payment/payment-constants";
import { findActiveFlow, logFlowEvent } from "@/lib/flow-logger";
import { logger } from "@/lib/utils/logger";

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
    if (processingLockRef.current) return; // Synchronous double-click guard
    const totalToPay = selectedTotal + tipAmount;
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

    if (Math.abs(totalPayments - totalToPay) > 0.01) {
      toast.error(`Los pagos (${totalPayments}) no coinciden con el total (${totalToPay})`);
      return;
    }

    try {
      processingLockRef.current = true;
      setProcessing(true);
      const supabase = createClient();

      // ─── Resolve identity (stays on frontend — needs auth context) ───
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user session");

      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!employee) throw new Error("No employee profile found for this user");

      // ─── Build payment data for RPC ────────────────────────────────
      const validPayments = payments.filter(p => p.amount > 0);
      const itemIds = Array.from(selectedItems);

      const paymentData = validPayments.map(p => ({
        amount: p.amount,
        method: p.method,
        terminal: p.terminal || null,
        cardLast4: p.cardLast4 || null,
        cardType: p.cardType || null,
        reference: p.reference || null,
        collected_by: p.collected_by || null,
      }));

      // ─── Single atomic RPC call ────────────────────────────────────
      const { data: rpcResult, error: rpcError } = await supabase.rpc('process_granular_payment', {
        p_sales_order_id: salesOrderId,
        p_employee_id: employee.id,
        p_user_id: user.id,
        p_item_ids: itemIds,
        p_payments: paymentData,
        p_tip_amount: tipAmount,
        p_selected_total: selectedTotal,
      });

      if (rpcError) {
        logger.error("RPC process_granular_payment failed", rpcError);
        throw new Error(rpcError.message);
      }

      if (!rpcResult?.success) {
        logger.error("RPC process_granular_payment returned error", rpcResult);
        throw new Error(rpcResult?.error || "Error desconocido al procesar pago");
      }

      // ─── Success feedback ──────────────────────────────────────────
      toast.success("Pago procesado correctamente");

      if (rpcResult.room_unblocked) {
        toast.info("Habitación desbloqueada → OCUPADA");
      }

      console.log(`✅ Pago procesado: ${rpcResult.payments_processed} pago(s), ` +
        `${rpcResult.valet_payments_consumed} del cochero, ` +
        `${rpcResult.new_payments_created} nuevo(s), ` +
        `restante: $${rpcResult.new_remaining}`);

      // ─── Flow Event (fire-and-forget) ──────────────────────────────
      try {
        const { data: stayForFlow } = await supabase
          .from("room_stays")
          .select("id")
          .eq("sales_order_id", salesOrderId)
          .eq("status", "ACTIVA")
          .maybeSingle();
        if (stayForFlow) {
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

      // ─── Print receipt (fire-and-forget) ───────────────────────────
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
              remainingAmount: rpcResult.new_remaining
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

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
    .filter(i => selectedItems.has(i.id) && !i.is_paid)
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

      // Fetch employee profile to get the public UUID (employees.id)
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!employee) throw new Error("No employee profile found for this user");

      // 1. Marcar ítems seleccionados como pagados
      if (selectedItems.size > 0) {
        const itemIds = Array.from(selectedItems);
        const { error: itemsError } = await supabase
          .from("sales_order_items")
          .update({
            is_paid: true,
            paid_at: new Date().toISOString()
          })
          .in("id", itemIds);

        if (itemsError) throw itemsError;
      }

      // 1.5. Finalizar pagos reportados por valet (limpia el indicador y el histórico)
      const { error: valetConfirmError } = await supabase
        .from("payments")
        .update({
          status: "PAGADO",
          confirmed_at: new Date().toISOString(),
          confirmed_by: employee.id
        })
        .eq("sales_order_id", salesOrderId)
        .eq("status", "COBRADO_POR_VALET");

      if (valetConfirmError) {
        console.error("Error confirming valet payments:", valetConfirmError);
        // No lanzamos error para no detener el flujo principal
      }

      // 1.6. Limpiar pagos PENDIENTE (ej. hora extra auto) para evitar duplicados
      await supabase
        .from("payments")
        .delete()
        .eq("sales_order_id", salesOrderId)
        .eq("status", "PENDIENTE");


      // 2. Obtener sesión activa para enlazar el pago a la caja del recepcionista (opcional)
      const { data: session } = await supabase
        .from('shift_sessions')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('status', 'active')
        .maybeSingle();

      // 3. Insertar cada pago desglosado (Efectivo, Tarjeta 1, Tarjeta 2, etc.)
      for (const p of payments) {
        if (p.amount > 0) {
          const { error: payError } = await supabase.from("payments").insert({
            sales_order_id: salesOrderId,
            amount: p.amount,
            payment_method: p.method,
            card_last_4: p.cardLast4 || null,
            card_type: p.cardType || null,
            terminal_code: p.terminal || null,
            reference: p.reference || `PAGO-${Date.now().toString(36).toUpperCase()}`,
            concept: "PAGO_POR_CONCEPTOS",
            status: "PAGADO",
            payment_type: payments.length > 1 ? "PARCIAL" : "COMPLETO",
            created_by: employee.id,
            shift_session_id: session?.id || null,
            collected_at: new Date().toISOString()
          });
          if (payError) throw payError;
        }
      }

      // 4. Si hay propina, insertarla
      if (tipAmount > 0) {
         await supabase.from("payments").insert({
            sales_order_id: salesOrderId,
            amount: tipAmount,
            payment_method: payments[0]?.method || "EFECTIVO", // Asumir el método principal
            concept: "PROPINA",
            status: "PAGADO",
            created_by: employee.id,
            shift_session_id: session?.id || null,
            collected_at: new Date().toISOString()
         });
      }

      // 5. Actualizar los totales del sales_order principal
      const { data: order } = await supabase
        .from("sales_orders")
        .select("total, paid_amount")
        .eq("id", salesOrderId)
        .single();

      if (order) {
        const newPaidAmount = Number(order.paid_amount || 0) + selectedTotal; // No sumar propina al paid_amount de la orden (normalmente la propina es aparte)
        const newRemaining = Math.max(0, Number(order.total || 0) - newPaidAmount);

        const { error: orderError } = await supabase
          .from("sales_orders")
          .update({
            paid_amount: newPaidAmount,
            remaining_amount: newRemaining,
            status: newRemaining <= 0 ? "PAID" : "PARTIAL"
          })
          .eq("id", salesOrderId);
          
        if (orderError) throw orderError;
      }

      // 6. Limpiar datos de cobro del valet (checkout_payment_data) para que no reaparezcan
      await supabase
        .from("room_stays")
        .update({ checkout_payment_data: null })
        .eq("sales_order_id", salesOrderId);

      // 7. Si la habitación estaba bloqueada (por hora extra o similar), devolver a OCUPADA
      // Mejor obtenemos el room_id directamente de la estancia vinculada a la orden
      const { data: stayData } = await supabase
        .from("room_stays")
        .select("room_id")
        .eq("sales_order_id", salesOrderId)
        .single();

      if (stayData?.room_id) {
        const { data: roomData } = await supabase
          .from("rooms")
          .select("status")
          .eq("id", stayData.room_id)
          .single();

        if (roomData?.status === "BLOQUEADA") {
          await supabase
            .from("rooms")
            .update({ status: "OCUPADA" })
            .eq("id", stayData.room_id);
        }
      }

      toast.success("Pago procesado correctamente");
      setPayments(createInitialPayment(0));
      setTipAmount(0);
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

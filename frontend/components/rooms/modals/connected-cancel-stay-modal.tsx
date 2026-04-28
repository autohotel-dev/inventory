"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Room } from "@/components/sales/room-types";
import { CancelStayModal } from "@/components/sales/cancel-stay-modal";
import { getActiveStay } from "@/hooks/room-actions";
import { notifyActiveValets } from "@/lib/services/valet-notification-service";
import { AuthorizationGate } from "@/components/auth/authorization-gate";

interface ConnectedCancelStayModalProps {
  room: Room | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectedCancelStayModal({
  room,
  isOpen,
  onClose,
  onSuccess,
}: ConnectedCancelStayModalProps) {
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const activeStay = room ? getActiveStay(room) : null;
  const salesOrderId = activeStay?.sales_order_id || "";

  const elapsedMinutes = (() => {
    if (!activeStay?.check_in_at) return 0;
    const checkIn = new Date(activeStay.check_in_at);
    return Math.floor((new Date().getTime() - checkIn.getTime()) / 60000);
  })();

  const handleConfirm = async (data: { reason: string; refundType?: "none" | "partial" | "full"; refundAmount?: number }) => {
    if (!room || !activeStay) return;

    setLoading(true);
    const supabase = createClient();

    try {
      // ═══════════════════════════════════════════════════════════
      // PASO 1: Finalizar la estancia como CANCELADA
      // ═══════════════════════════════════════════════════════════
      const { error: stayError } = await supabase
        .from("room_stays")
        .update({
          status: "CANCELADA",
          actual_check_out_at: new Date().toISOString(),
        })
        .eq("id", activeStay.id);
      
      if (stayError) throw stayError;

      // ═══════════════════════════════════════════════════════════
      // PASO 2: Marcar habitación como SUCIA
      // ═══════════════════════════════════════════════════════════
      const { error: roomError } = await supabase
        .from("rooms")
        .update({ status: "SUCIA" })
        .eq("id", room.id);
      
      if (roomError) throw roomError;

      // ═══════════════════════════════════════════════════════════
      // PASO 3: Cancelar TODOS los pagos no finalizados
      // Cubre: PENDIENTE, COBRADO_POR_VALET, CORROBORADO_RECEPCION
      // Anti-bloqueo: falla parcial no detiene el flujo
      // ═══════════════════════════════════════════════════════════
      let valetMoneyWarning = 0;
      try {
        // Primero contar cuánto dinero tiene el cochero (para el mensaje)
        const { data: valetPayments } = await supabase
          .from("payments")
          .select("amount, status")
          .eq("sales_order_id", activeStay.sales_order_id)
          .in("status", ["COBRADO_POR_VALET", "CORROBORADO_RECEPCION"]);

        valetMoneyWarning = (valetPayments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

        // Cancelar pagos no finalizados
        const { error: cancelPaymentsError } = await supabase
          .from("payments")
          .update({ 
            status: "CANCELADO",
            notes: `Cancelado por cancelación de estancia: ${data.reason}`
          })
          .eq("sales_order_id", activeStay.sales_order_id)
          .in("status", ["PENDIENTE", "COBRADO_POR_VALET", "CORROBORADO_RECEPCION"]);

        if (cancelPaymentsError) {
          console.error("Error cancelling payments (non-blocking):", cancelPaymentsError);
        }
      } catch (paymentCleanupErr) {
        console.error("Payment cleanup failed (non-blocking):", paymentCleanupErr);
      }

      // ═══════════════════════════════════════════════════════════
      // PASO 4: Limpiar datos del room_stay
      // Limpia: checkout_payment_data, timestamps de solicitudes
      // Anti-bloqueo: falla parcial no detiene el flujo
      // ═══════════════════════════════════════════════════════════
      try {
        await supabase
          .from("room_stays")
          .update({
            checkout_payment_data: null,
            vehicle_requested_at: null,
            valet_checkout_requested_at: null,
          })
          .eq("id", activeStay.id);
      } catch (stayCleanupErr) {
        console.error("Stay data cleanup failed (non-blocking):", stayCleanupErr);
      }

      // ═══════════════════════════════════════════════════════════
      // PASO 5: Cancelar sales_order_items no pagados
      // Anti-bloqueo: falla parcial no detiene el flujo
      // ═══════════════════════════════════════════════════════════
      try {
        await supabase
          .from("sales_order_items")
          .update({ 
            delivery_status: "CANCELLED",
            is_paid: false
          })
          .eq("sales_order_id", activeStay.sales_order_id)
          .eq("is_paid", false);
      } catch (itemsCleanupErr) {
        console.error("Items cleanup failed (non-blocking):", itemsCleanupErr);
      }

      // ═══════════════════════════════════════════════════════════
      // PASO 6: Calcular monto retenido y actualizar orden
      // ═══════════════════════════════════════════════════════════
      const { data: currentOrder } = await supabase
        .from("sales_orders")
        .select("paid_amount")
        .eq("id", activeStay.sales_order_id)
        .single();

      const totalPaid = currentOrder?.paid_amount || 0;
      let retainedAmount = 0;
      const refundType = data.refundType || "none";
      const refundAmount = data.refundAmount || 0;

      if (refundType === "none") {
        retainedAmount = totalPaid;
      } else if (refundType === "full") {
        retainedAmount = 0;
      } else if (refundType === "partial") {
        retainedAmount = Math.max(0, totalPaid - refundAmount);
      }

      const orderUpdateNote = `❌ CANCELADA: ${data.reason}. Reembolso: ${refundType === "full" ? "Total" : refundType === "partial" ? `Parcial $${refundAmount}` : "Sin reembolso"} (Retenido: $${retainedAmount})`;

      const { error: orderError } = await supabase
        .from("sales_orders")
        .update({ 
          status: "CANCELLED",
          subtotal: retainedAmount,
          total: retainedAmount,
          paid_amount: retainedAmount,
          remaining_amount: 0,
          notes: orderUpdateNote
        })
        .eq("id", activeStay.sales_order_id);
      
      if (orderError) throw orderError;

      // ═══════════════════════════════════════════════════════════
      // PASO 7: Borrar historial de habitación
      // Anti-bloqueo: falla parcial no detiene el flujo
      // ═══════════════════════════════════════════════════════════
      try {
        await supabase
          .from("room_status_history")
          .delete()
          .eq("sales_order_id", activeStay.sales_order_id);
      } catch (historyErr) {
        console.error("History cleanup failed (non-blocking):", historyErr);
      }

      // ═══════════════════════════════════════════════════════════
      // PASO 8: Concatenar notas (preservar previas)
      // Anti-bloqueo: falla parcial no detiene el flujo
      // ═══════════════════════════════════════════════════════════
      try {
        const { data: orderData } = await supabase
          .from("sales_orders")
          .select("notes")
          .eq("id", activeStay.sales_order_id)
          .single();

        const oldNotes = orderData?.notes ? orderData.notes.replace(orderUpdateNote, "").trim() : "";
        const newNotes = `${oldNotes}\n${orderUpdateNote}`.trim();
        
        await supabase
          .from("sales_orders")
          .update({ notes: newNotes })
          .eq("id", activeStay.sales_order_id);
      } catch (notesErr) {
        console.error("Notes update failed (non-blocking):", notesErr);
      }

      // ═══════════════════════════════════════════════════════════
      // PASO 9: Notificar cocheros activos
      // Solo si había un cochero asignado o hay dinero en sus manos
      // Anti-bloqueo: falla parcial no detiene el flujo
      // ═══════════════════════════════════════════════════════════
      try {
        if (activeStay.valet_employee_id || valetMoneyWarning > 0) {
          const moneyMsg = valetMoneyWarning > 0 
            ? ` Devuelve $${valetMoneyWarning.toFixed(2)} (dinero/vouchers) a recepción.`
            : '';
          
          await notifyActiveValets(
            supabase,
            '❌ Estancia Cancelada',
            `Hab. ${room.number}: La estancia fue cancelada. Motivo: ${data.reason}.${moneyMsg}`,
            {
              type: 'STAY_CANCELLED',
              roomNumber: room.number,
              stayId: activeStay.id,
              hasMoney: valetMoneyWarning > 0,
              moneyAmount: valetMoneyWarning
            }
          );
        }
      } catch (notifyErr) {
        console.error("Valet notification failed (non-blocking):", notifyErr);
      }

      // ═══════════════════════════════════════════════════════════
      // ÉXITO - Mensaje contextual según la situación
      // ═══════════════════════════════════════════════════════════
      const refundMsg = refundType !== "none" ? ` | Reembolso: $${refundAmount.toFixed(2)}` : "";
      const valetMsg = valetMoneyWarning > 0 ? ` | ⚠️ Recupera $${valetMoneyWarning.toFixed(2)} del cochero` : "";
      
      toast.success("Estancia cancelada", {
        description: `Hab. ${room.number}${refundMsg}${valetMsg}`,
        duration: valetMoneyWarning > 0 ? 8000 : 4000, // Más tiempo si hay dinero del cochero
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error al cancelar estancia:", error);
      toast.error("Error al cancelar la estancia", {
        description: "Ocurrió un error inesperado al procesar la cancelación.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    setAuthorized(false);
    onClose();
  }, [onClose]);

  const handleAuthorized = useCallback(() => {
    setAuthorized(true);
  }, []);

  // Paso 1: Puerta de autorización (admin/manager pasa automáticamente)
  if (isOpen && !!room && !authorized) {
    return (
      <AuthorizationGate
        isOpen={true}
        title="Cancelar Estancia"
        description={`Autorización requerida para cancelar Hab. ${room.number}`}
        onAuthorized={handleAuthorized}
        onClose={handleClose}
      />
    );
  }

  // Paso 2: Modal de cancelación (solo si ya fue autorizado)
  return (
    <CancelStayModal
      isOpen={isOpen && !!room && authorized}
      salesOrderId={salesOrderId}
      roomNumber={room?.number || ""}
      roomTypeName={room?.room_types?.name || ""}
      elapsedMinutes={elapsedMinutes}
      actionLoading={loading}
      onClose={handleClose}
      onConfirm={handleConfirm}
    />
  );
}


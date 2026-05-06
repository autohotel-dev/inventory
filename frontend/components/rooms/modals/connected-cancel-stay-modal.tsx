"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
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

    try {
      const { apiClient } = await import("@/lib/api/client");
      
      // ═══════════════════════════════════════════════════════════
      // PASO 1: Finalizar la estancia como CANCELADA
      // ═══════════════════════════════════════════════════════════
      await apiClient.patch(`/system/crud/room_stays/${activeStay.id}`, {
        status: "CANCELADA",
        actual_check_out_at: new Date().toISOString(),
      });

      // ═══════════════════════════════════════════════════════════
      // PASO 2: Marcar habitación como SUCIA
      // ═══════════════════════════════════════════════════════════
      await apiClient.patch(`/system/crud/rooms/${room.id}`, { status: "SUCIA" });

      // ═══════════════════════════════════════════════════════════
      // PASO 3: Cancelar TODOS los pagos no finalizados
      // Cubre: PENDIENTE, COBRADO_POR_VALET, CORROBORADO_RECEPCION
      // Anti-bloqueo: falla parcial no detiene el flujo
      // ═══════════════════════════════════════════════════════════
      let valetMoneyWarning = 0;
      try {
        const res = await apiClient.get(`/system/crud/payments?sales_order_id=${activeStay.sales_order_id}`);
        const allPayments = res.data || [];
        
        const valetPayments = allPayments.filter((p: any) => ["COBRADO_POR_VALET", "CORROBORADO_RECEPCION"].includes(p.status));
        valetMoneyWarning = valetPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

        const toCancel = allPayments.filter((p: any) => ["PENDIENTE", "COBRADO_POR_VALET", "CORROBORADO_RECEPCION"].includes(p.status));
        for (const p of toCancel) {
          await apiClient.patch(`/system/crud/payments/${p.id}`, {
            status: "CANCELADO",
            notes: `Cancelado por cancelación de estancia: ${data.reason}`
          });
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
        await apiClient.patch(`/system/crud/room_stays/${activeStay.id}`, {
          checkout_payment_data: null,
          vehicle_requested_at: null,
          valet_checkout_requested_at: null,
        });
      } catch (stayCleanupErr) {
        console.error("Stay data cleanup failed (non-blocking):", stayCleanupErr);
      }

      // ═══════════════════════════════════════════════════════════
      // PASO 5: Cancelar sales_order_items no pagados
      // Anti-bloqueo: falla parcial no detiene el flujo
      // ═══════════════════════════════════════════════════════════
      try {
        const res = await apiClient.get(`/system/crud/sales_order_items?sales_order_id=${activeStay.sales_order_id}`);
        for (const item of (res.data || [])) {
          if (!item.is_paid) {
            await apiClient.patch(`/system/crud/sales_order_items/${item.id}`, {
              delivery_status: "CANCELLED",
              is_paid: false
            });
          }
        }
      } catch (itemsCleanupErr) {
        console.error("Items cleanup failed (non-blocking):", itemsCleanupErr);
      }

      // ═══════════════════════════════════════════════════════════
      // PASO 6: Calcular monto retenido y actualizar orden
      // ═══════════════════════════════════════════════════════════
      let currentOrder = null;
      try {
        const res = await apiClient.get(`/system/crud/sales_orders/${activeStay.sales_order_id}`);
        currentOrder = res.data;
      } catch(e) {}

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
      const oldNotes = currentOrder?.notes ? currentOrder.notes.replace(orderUpdateNote, "").trim() : "";
      const newNotes = `${oldNotes}\n${orderUpdateNote}`.trim();

      await apiClient.patch(`/system/crud/sales_orders/${activeStay.sales_order_id}`, {
        status: "CANCELLED",
        subtotal: retainedAmount,
        total: retainedAmount,
        paid_amount: retainedAmount,
        remaining_amount: 0,
        notes: newNotes
      });

      // ═══════════════════════════════════════════════════════════
      // PASO 7: Borrar historial de habitación
      // Anti-bloqueo: falla parcial no detiene el flujo
      // ═══════════════════════════════════════════════════════════
      try {
        const res = await apiClient.get(`/system/crud/room_status_history?room_id=${room.id}`);
        for (const h of (res.data || [])) {
          await apiClient.delete(`/system/crud/room_status_history/${h.id}`);
        }
      } catch (historyErr) {
        console.error("History cleanup failed (non-blocking):", historyErr);
      }

      // ═══════════════════════════════════════════════════════════
      // PASO 8: Notas combinadas en el Paso 6
      // ═══════════════════════════════════════════════════════════

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


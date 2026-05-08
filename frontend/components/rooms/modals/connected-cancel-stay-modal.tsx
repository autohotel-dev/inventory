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
      // PASO 1: Ejecutar RPC de cancelación (Todo en una sola transacción)
      // ═══════════════════════════════════════════════════════════
      const refundType = data.refundType || "none";
      const refundAmount = data.refundAmount || 0;

      const { data: rpcResult, error: rpcError } = await supabase.rpc('process_cancel_stay', {
        p_room_stay_id: activeStay.id,
        p_room_id: room.id,
        p_sales_order_id: activeStay.sales_order_id,
        p_reason: data.reason,
        p_refund_type: refundType,
        p_refund_amount: refundAmount
      });

      if (rpcError) throw rpcError;
      if (rpcResult && (rpcResult as any).success === false) {
        throw new Error((rpcResult as any).error || "Error en RPC de cancelación");
      }

      const valetMoneyWarning = rpcResult ? Number((rpcResult as any).valetMoneyWarning || 0) : 0;

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


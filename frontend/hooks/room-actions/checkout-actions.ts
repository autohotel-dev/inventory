/**
 * Checkout-related room actions: prepare, process, room status.
 * Uses checkout-pipeline.ts for validation and payment building.
 */
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room } from "@/components/sales/room-types";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { logger } from "@/lib/utils/logger";

import { logFinancialAction } from "@/lib/audit-logger";
import { findActiveFlow, logFlowEvent, completeFlow } from "@/lib/flow-logger";
import {
  getActiveStay,
  withAction,
  withBoolAction,
  RoomActionContext,
} from "./room-action-helpers";
import { unsubscribeGuestNotifications } from "./checkout-pipeline";

export function createCheckoutActions(ctx: RoomActionContext) {
  const { checkAuthorization, onRefresh } = ctx;

  /**
   * Prepara checkout: sincroniza horas extra y lee saldo pendiente.
   */
  const prepareCheckout = async (room: Room) => {
    const activeStay = getActiveStay(room);
    if (!activeStay) {
      toast.error("No se encontró una estancia activa para esta habitación");
      return null;
    }

    const supabase = createClient();

    try {
      // Sincronizar horas extra pendientes vía RPC atómico
      if (room.room_types?.extra_hour_price && room.room_types.extra_hour_price > 0) {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('process_extra_hours_v2', {
          p_stay_id: activeStay.id
        });

        if (rpcError) {
          console.error("[prepareCheckout] Error calling RPC:", rpcError);
        } else if (rpcResult?.success && rpcResult.hours_added > 0) {
          toast.success("Horas extra registradas", {
            description: `${rpcResult.hours_added} hora(s) extra en Hab. ${room.number}`,
          });
        }
      }

      if (!activeStay.sales_order_id) {
        toast.error("Error crítico: Estancia sin orden de venta");
        return null;
      }

      const { data: order, error } = await supabase
        .from("sales_orders")
        .select("remaining_amount")
        .eq("id", activeStay.sales_order_id)
        .single();

      if (error || !order) {
        toast.error("No se pudo obtener el saldo pendiente.");
        return null;
      }

      return {
        salesOrderId: activeStay.sales_order_id,
        remainingAmount: Number(order.remaining_amount) || 0,
      };
    } catch (e) {
      console.error("Error preparing checkout:", e);
      toast.error("No se pudo preparar el check-out");
      return null;
    }
  };

  /**
   * Procesa checkout completo usando la pipeline de validación.
   */
  const processCheckout = async (
    room: Room,
    checkoutInfo: { salesOrderId: string; remainingAmount: number },
    amount: number,
    payments?: PaymentEntry[],
    checkoutValetId?: string | null
  ): Promise<boolean> => {
    if (!checkAuthorization("Finalizar Salida")) return false;

    return withBoolAction(ctx, "Error inesperado en checkout", async () => {
      const supabase = createClient();
      const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || amount;

      // Privacy cleanup (fire-and-forget — external API, not DB)
      unsubscribeGuestNotifications(room.number);

      // Build payment data for RPC
      const paymentData = (payments || []).filter(p => p.amount > 0).map(p => ({
        amount: p.amount,
        method: p.method,
        terminal: p.terminal || null,
        cardLast4: p.cardLast4 || null,
        cardType: p.cardType || null,
        reference: p.reference || null,
      }));

      // Single atomic RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('process_full_checkout', {
        p_sales_order_id: checkoutInfo.salesOrderId,
        p_checkout_valet_id: checkoutValetId || null,
        p_payments: paymentData,
        p_total_paid: totalPaid,
      });

      if (rpcError) {
        logger.error("RPC Checkout Failed", rpcError);
        toast.error("Error crítico en checkout", { description: rpcError.message });
        return false;
      }

      if (rpcData && !rpcData.success) {
        toast.error("Error en checkout", { description: rpcData.error });
        return false;
      }

      // Success
      const remainingTotal = rpcData?.new_remaining ?? Math.max(0, checkoutInfo.remainingAmount - totalPaid);
      const paymentMethod = rpcData?.payment_method || "EFECTIVO";

      toast.success("Check-out completado exitosamente", {
        description: remainingTotal > 0
          ? `Saldo restante: $${remainingTotal.toFixed(2)}`
          : `Hab. ${room.number} → SUCIA`
      });

      // ─── Audit Log ─────────────────────────────────────────────
      logFinancialAction("CHECKOUT", {
        roomNumber: room.number,
        amount: totalPaid,
        paymentMethod: paymentMethod,
        salesOrderId: checkoutInfo.salesOrderId,
        description: `Checkout Hab. ${room.number}: $${totalPaid.toFixed(2)} cobrados. Saldo restante: $${remainingTotal.toFixed(2)}`,
        extra: { remaining: remainingTotal, checkout_valet_id: checkoutValetId },
      });

      // ─── Flow Event ─────────────────────────────────────────────
      const stayForFlow = getActiveStay(room);
      if (stayForFlow) {
        findActiveFlow(stayForFlow.id).then(flowId => {
          if (flowId) {
            logFlowEvent(flowId, {
              event_type: "CHECKOUT_COMPLETED",
              description: `Checkout completado: $${totalPaid.toFixed(2)} cobrados`,
              metadata: { amount: totalPaid, payment_method: paymentMethod, remaining: remainingTotal, checkout_valet_id: checkoutValetId },
            });
            completeFlow(flowId);
          }
        });
      }

      await onRefresh();
      return true;
    });
  };

  /**
   * Update room status (clean, block, dirty, etc.)
   */
  const updateRoomStatus = async (
    room: Room,
    newStatus: "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA",
    successMessage: string,
    notes?: string
  ) => {
    if (!checkAuthorization("Cambiar Estado de Habitación")) return;

    await withAction(ctx, "Ocurrió un error al actualizar la habitación", async () => {
      const supabase = createClient();

      // Single atomic RPC — handles stay finalization, status update, and audit
      const { data: rpcData, error: rpcError } = await supabase.rpc('update_room_status', {
        p_room_id: room.id,
        p_new_status: newStatus,
        p_notes: notes ?? null,
        p_clear_notes: newStatus === "LIBRE",
      });

      if (rpcError) {
        toast.error("No se pudo actualizar el estado de la habitación");
        logger.error("RPC update_room_status failed", rpcError);
        return;
      }

      if (rpcData && !rpcData.success) {
        toast.error(rpcData.error || "Error al cambiar estado");
        return;
      }

      toast.success(successMessage);

      // Flow Event (fire-and-forget — no blocking)
      const stayForStatus = getActiveStay(room);
      if (stayForStatus) {
        findActiveFlow(stayForStatus.id).then(flowId => {
          if (flowId) {
            logFlowEvent(flowId, {
              event_type: "ROOM_STATUS_CHANGED",
              description: `Estado de habitación cambiado a ${newStatus}`,
              metadata: { new_status: newStatus, notes },
            });
          }
        });
      }
    });
  };

  return { prepareCheckout, processCheckout, updateRoomStatus };
}

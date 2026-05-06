import { apiClient } from "@/lib/api/client";
/**
 * Checkout-related room actions: prepare, process, room status.
 * Uses checkout-pipeline.ts for validation and payment building.
 */
import { toast } from "sonner";
import { Room } from "@/components/sales/room-types";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { logger } from "@/lib/utils/logger";
import { updateAllUnpaidItems } from "@/lib/services/product-service";
import { logFinancialAction } from "@/lib/audit-logger";
import { findActiveFlow, logFlowEvent, completeFlow } from "@/lib/flow-logger";
import {
  getActiveStay,
  withAction,
  withBoolAction,
  getCurrentEmployeeId,
  RoomActionContext,
} from "./room-action-helpers";
import {
  unsubscribeGuestNotifications,
  buildCheckoutPayments,
} from "./checkout-pipeline";

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

    try {
      // Sincronizar horas extra pendientes vía API
      if (room.room_types?.extra_hour_price && room.room_types.extra_hour_price > 0) {
        const { apiClient } = await import("@/lib/api/client");
        try {
          const response = await apiClient.post(`/rooms/${room.id}/extra-hours`, {
            stay_id: activeStay.id
          });
          const rpcResult = response.data;
          
          if (rpcResult?.success && rpcResult.hours_added > 0) {
            toast.success("Horas extra registradas", {
              description: `${rpcResult.hours_added} hora(s) extra en Hab. ${room.number}`,
            });
          }
        } catch (err: any) {
          console.error("[prepareCheckout] Error calling API:", err);
        }
      }

      if (!activeStay.sales_order_id) {
        toast.error("Error crítico: Estancia sin orden de venta");
        return null;
      }

      const { apiClient } = await import("@/lib/api/client");
      let order;
      try {
        const res = await apiClient.get(`/sales/orders/${activeStay.sales_order_id}`);
        order = res.data;
      } catch (e) {
        order = null;
      }

      if (!order) {
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
      const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || amount;

      // Step 1: Validate stay state
      const { validateCheckoutPipeline } = await import("./checkout-pipeline");
      const validationData = await validateCheckoutPipeline(room.id);
      if (!validationData.ok) return false;
      const validation = { stayId: validationData.stay_id, ok: true };


      // Step 2: Validate no blocking deliveries
      

      // Step 3: Privacy cleanup
      await unsubscribeGuestNotifications(room.number);

      // Step 4: Mark unpaid service items (batch — 1 operation instead of 4)
      const paymentMethod = payments && payments.length > 0
        ? (payments.length > 1 ? "MULTIPAGO" : payments[0].method)
        : "EFECTIVO";

      await updateAllUnpaidItems(
        checkoutInfo.salesOrderId,
        ["EXTRA_PERSON", "EXTRA_HOUR", "ROOM_BASE", "TOLERANCE_EXPIRED"],
        paymentMethod
      );

      // Step 5: Build and reconcile payments
      const newPayments = await buildCheckoutPayments(checkoutInfo, payments, totalPaid);

      // Step 6: Atomic API call
      const { apiClient } = await import("@/lib/api/client");
      let rpcData;
      try {
        const response = await apiClient.post(`/rooms/${room.id}/checkout`, {
          stay_id: validation.stayId,
          sales_order_id: checkoutInfo.salesOrderId,
          payment_data: newPayments,
          checkout_valet_id: checkoutValetId || null,
          employee_id: await getCurrentEmployeeId()
        });
        rpcData = response.data;
      } catch (err: any) {
        logger.error("API Checkout Failed", err);
        toast.error("Error crítico en checkout", { description: err.response?.data?.detail || err.message });
        return false;
      }

      if (rpcData && (rpcData as any).success === false) {
        toast.error("Error en checkout", { description: (rpcData as any).error });
        return false;
      }

      // Success
      const remainingTotal = Math.max(0, checkoutInfo.remainingAmount - totalPaid);
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

      const updateData: any = { status: newStatus };
      if (notes !== undefined) updateData.notes = notes;
      else if (newStatus === "LIBRE") updateData.notes = null;

      const { apiClient } = await import("@/lib/api/client");
      try {
        await apiClient.patch(`/rooms/${room.id}/status`, updateData);
      } catch (err: any) {
        toast.error("No se pudo actualizar el estado de la habitación");
        return;
      }

      toast.success(successMessage);

      // ─── Audit Log ─────────────────────────────────────────────
      logFinancialAction("UPDATE", {
        roomNumber: room.number,
        description: `Estado de Hab. ${room.number} cambiado a ${newStatus}`,
        extra: { new_status: newStatus, notes },
      });

      // ─── Flow Event ─────────────────────────────────────────────
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

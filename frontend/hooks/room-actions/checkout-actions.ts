/**
 * Checkout-related room actions: prepare, process, room status.
 * Uses checkout-pipeline.ts for validation and payment building.
 */
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room } from "@/components/sales/room-types";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { logger } from "@/lib/utils/logger";
import { updateUnpaidItems } from "@/lib/services/product-service";
import {
  getActiveStay,
  withAction,
  withBoolAction,
  RoomActionContext,
} from "./room-action-helpers";
import {
  validateStayForCheckout,
  validateNoBlockingDeliveries,
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

      // Step 1: Validate stay state
      const validation = await validateStayForCheckout(supabase, checkoutInfo);
      if (!validation.ok) return false;

      // Step 2: Validate no blocking deliveries
      const deliveriesOk = await validateNoBlockingDeliveries(supabase, checkoutInfo.salesOrderId);
      if (!deliveriesOk) return false;

      // Step 3: Privacy cleanup
      await unsubscribeGuestNotifications(room.number);

      // Step 4: Mark unpaid service items
      const paymentMethod = payments && payments.length > 0
        ? (payments.length > 1 ? "MULTIPAGO" : payments[0].method)
        : "EFECTIVO";

      await Promise.all([
        updateUnpaidItems(checkoutInfo.salesOrderId, "EXTRA_PERSON", paymentMethod),
        updateUnpaidItems(checkoutInfo.salesOrderId, "EXTRA_HOUR", paymentMethod),
        updateUnpaidItems(checkoutInfo.salesOrderId, "ROOM_BASE", paymentMethod),
        updateUnpaidItems(checkoutInfo.salesOrderId, "TOLERANCE_EXPIRED", paymentMethod),
      ]);

      // Step 5: Build and reconcile payments
      const newPayments = await buildCheckoutPayments(supabase, checkoutInfo, payments, totalPaid);

      // Step 6: Atomic RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('process_checkout_transaction', {
        p_stay_id: validation.stayId,
        p_sales_order_id: checkoutInfo.salesOrderId,
        p_payment_data: newPayments,
        p_checkout_valet_id: checkoutValetId || null
      });

      if (rpcError) {
        logger.error("RPC Checkout Failed", rpcError);
        toast.error("Error crítico en checkout", { description: rpcError.message });
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

      const updateData: any = { status: newStatus };
      if (notes !== undefined) updateData.notes = notes;
      else if (newStatus === "LIBRE") updateData.notes = null;

      const { error } = await supabase.from("rooms").update(updateData).eq("id", room.id);
      if (error) { toast.error("No se pudo actualizar el estado de la habitación"); return; }

      if (newStatus === "LIBRE") {
        const { error: stayError } = await supabase
          .from("room_stays")
          .update({ status: "FINALIZADA", actual_check_out_at: new Date().toISOString() })
          .eq("room_id", room.id)
          .eq("status", "ACTIVA");

        if (stayError) console.error("Error finalizing stay on room free:", stayError);
        else logger.info("Stay finalized automatically on room free", { roomNumber: room.number });
      }

      toast.success(successMessage);
    });
  };

  return { prepareCheckout, processCheckout, updateRoomStatus };
}

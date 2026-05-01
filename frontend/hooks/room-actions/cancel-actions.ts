/**
 * Cancel-related room actions: cancel pending charge, cancel item.
 */
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room } from "@/components/sales/room-types";
import { logger } from "@/lib/utils/logger";
import { notifyActiveValets } from "@/lib/services/valet-notification-service";
import { logFinancialAction } from "@/lib/audit-logger";
import {
  getActiveStay,
  getReceptionEmployeeId,
  withBoolAction,
  RoomActionContext,
} from "./room-action-helpers";

export function createCancelActions(ctx: RoomActionContext) {
  const { checkAuthorization, onRefresh } = ctx;

  /**
   * Cancelar un cargo PENDIENTE (hora extra, promo, renovación, persona extra).
   */
  const handleCancelPendingCharge = async (
    paymentId: string, room: Room, concept: string, amount: number
  ): Promise<boolean> => {
    if (!checkAuthorization("Cancelar Cargo")) return false;

    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No hay estancia activa"); return false; }

    return withBoolAction(ctx, "Error al cancelar el cargo", async () => {
      const supabase = createClient();
      const currentEmployeeId = await getReceptionEmployeeId(supabase);

      const { data, error } = await supabase.rpc('cancel_reception_charge', {
        p_payment_id: paymentId,
        p_employee_id: currentEmployeeId
      });

      if (error) { toast.error("Error al cancelar el cargo en la base de datos"); return false; }
      if (data && !data.success) { toast.error(data.error || "No se pudo cancelar el cargo"); return false; }

      const parts: string[] = [];
      if (data?.hours_deducted > 0) parts.push(`-${data.hours_deducted}h de tiempo`);
      if (data?.people_deducted > 0) parts.push(`-${data.people_deducted} persona(s)`);

      toast.success("Cargo cancelado", {
        description: parts.length > 0
          ? `${concept} - $${amount.toFixed(2)} | ${parts.join(', ')}`
          : `${concept} - $${amount.toFixed(2)} descontado`
      });

      // ─── Audit Log ─────────────────────────────────────────────
      logFinancialAction("CANCEL_CHARGE", {
        roomNumber: room.number,
        amount,
        stayId: activeStay.id,
        salesOrderId: activeStay.sales_order_id,
        description: `Cargo cancelado: ${concept} - $${amount.toFixed(2)} en Hab. ${room.number}`,
        extra: { concept, payment_id: paymentId, hours_deducted: data?.hours_deducted, people_deducted: data?.people_deducted },
        severity: "WARNING",
      });

      await notifyActiveValets(supabase, '🚫 Cargo Cancelado',
        `Recepción canceló un cobro de $${amount.toFixed(2)} en Hab. ${room.number}. Concepto: ${concept}.`,
        { type: 'CHARGE_CANCELLED', roomNumber: room.number, stayId: activeStay.id }
      );

      await onRefresh();
      return true;
    });
  };

  /**
   * Cancelar un item específico de la orden.
   */
  const handleCancelItem = async (
    itemId: string, room: Room, reason: string
  ): Promise<boolean> => {
    if (!checkAuthorization("Cancelar Item")) return false;

    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No hay estancia activa"); return false; }

    return withBoolAction(ctx, "Ocurrió un error inesperado al cancelar", async () => {
      const supabase = createClient();
      const currentEmployeeId = await getReceptionEmployeeId(supabase);

      const { data, error } = await supabase.rpc('cancel_item_with_refund', {
        p_item_id: itemId,
        p_employee_id: currentEmployeeId,
        p_reason: reason
      });

      if (error) { toast.error("Error al cancelar el item en la base de datos"); return false; }
      if (!data.success) { toast.error(data.error || "No se pudo cancelar el item"); return false; }

      const parts: string[] = [];
      if (data.refund_created) parts.push(`Reembolso de $${Number(data.amount).toFixed(2)}`);
      if (data.hours_deducted > 0) parts.push(`-${data.hours_deducted}h de tiempo`);
      if (data.people_deducted > 0) parts.push(`-${data.people_deducted} persona(s)`);
      if (data.inventory_returned) parts.push(`Stock devuelto`);

      toast.success("Item cancelado correctamente", {
        description: parts.length > 0 ? parts.join(' | ') : `$${Number(data.amount).toFixed(2)} descontados`,
      });

      // ─── Audit Log ─────────────────────────────────────────────
      logFinancialAction("CANCEL_ITEM", {
        roomNumber: room.number,
        amount: Number(data.amount),
        stayId: activeStay.id,
        itemId: itemId,
        description: `Item cancelado en Hab. ${room.number}: $${Number(data.amount).toFixed(2)}. Motivo: ${reason}`,
        extra: { reason, refund_created: data.refund_created, inventory_returned: data.inventory_returned },
        severity: "WARNING",
      });

      await notifyActiveValets(supabase, '🚫 Item Cancelado',
        `Recepción canceló un cargo de $${Number(data.amount).toFixed(2)} en Hab. ${room.number}. Motivo: ${reason}`,
        { type: 'CHARGE_CANCELLED', roomNumber: room.number, stayId: activeStay.id }
      );

      await onRefresh();
      return true;
    });
  };

  return { handleCancelPendingCharge, handleCancelItem };
}

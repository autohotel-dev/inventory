/**
 * Time-related room actions: custom hours, renewal, 4h promo, damage charge.
 * All charge operations use the unified `process_extra_charge` RPC for
 * atomic, single-round-trip execution.
 */
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room } from "@/components/sales/room-types";
import { formatCurrency } from "@/lib/utils/formatters";
import { notifyActiveValets } from "@/lib/services/valet-notification-service";
import { logFinancialAction } from "@/lib/audit-logger";
import { findActiveFlow, logFlowEvent } from "@/lib/flow-logger";
import {
  getActiveStay,
  getReceptionShiftId,
  generatePaymentReference,
  withAction,
  RoomActionContext,
} from "./room-action-helpers";

export function createTimeActions(ctx: RoomActionContext) {
  const { checkAuthorization } = ctx;

  /**
   * Agregar cargo por daño
   */
  const handleAddDamageCharge = async (room: Room, amount: number, description: string) => {
    if (!checkAuthorization("Registrar Daño")) return;
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No se encontró una estancia activa"); return; }
    if (amount <= 0 || !description) { toast.error("Datos inválidos para el cargo"); return; }

    await withAction(ctx, "Error al registrar cargo por daño", async () => {
      const supabase = createClient();
      const currentShiftId = await getReceptionShiftId(supabase);

      const { data: rpc, error: rpcError } = await supabase.rpc("process_extra_charge", {
        p_stay_id: activeStay.id,
        p_charge_type: "DAMAGE_CHARGE",
        p_amount: amount,
        p_quantity: 1,
        p_hours_to_extend: 0,
        p_description: description,
        p_shift_session_id: currentShiftId,
        p_payment_reference: generatePaymentReference("DMG"),
      });

      if (rpcError || !rpc?.success) {
        throw new Error(rpcError?.message || rpc?.error || "Error al registrar el daño");
      }

      toast.success("Cargo por daño registrado", {
        description: `Hab. ${room.number}: ${formatCurrency(amount)} - ${description}`,
      });

      // ─── Audit Log ─────────────────────────────────────────────
      logFinancialAction("DAMAGE_CHARGE", {
        roomNumber: room.number,
        amount,
        stayId: activeStay.id,
        salesOrderId: activeStay.sales_order_id,
        description: `Daño registrado en Hab. ${room.number}: $${amount.toFixed(2)} - ${description}`,
        severity: "WARNING",
      });

      // ─── Flow Event ─────────────────────────────────────────────
      findActiveFlow(activeStay.id).then(flowId => {
        if (flowId) {
          logFlowEvent(flowId, {
            event_type: "DAMAGE_REPORTED",
            description: `Daño: ${description} - $${amount.toFixed(2)}`,
            metadata: { amount, description },
          });
        }
      });

      await notifyActiveValets(supabase, '🛠️ Cargo por Daño',
        `Habitación ${room.number}: Se registró un daño ($${amount.toFixed(2)}). Descripción: ${description}`,
        { type: 'NEW_EXTRA', consumptionId: rpc.item_id, roomNumber: room.number, stayId: activeStay.id }
      );
    });
  };

  /**
   * Agregar horas personalizadas con pago
   */
  const handleAddCustomHours = async (room: Room, hours: number, isCourtesy?: boolean, courtesyReason?: string) => {
    if (!checkAuthorization("Agregar Horas")) return;
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No se encontró una estancia activa"); return; }

    const hourPrice = room.room_types?.extra_hour_price ?? 0;
    if (!isCourtesy && hourPrice <= 0) { toast.error("No se configuró precio de hora extra"); return; }

    const totalPrice = isCourtesy ? 0 : hourPrice * hours;

    await withAction(ctx, "Error al agregar horas", async () => {
      const supabase = createClient();
      const currentShiftId = await getReceptionShiftId(supabase);

      const { data: rpc, error: rpcError } = await supabase.rpc("process_extra_charge", {
        p_stay_id: activeStay.id,
        p_charge_type: "EXTRA_HOUR",
        p_amount: hourPrice,
        p_quantity: hours,
        p_hours_to_extend: hours,
        p_shift_session_id: currentShiftId,
        p_payment_reference: generatePaymentReference("HEX"),
        p_is_courtesy: !!isCourtesy,
        p_courtesy_reason: courtesyReason || null,
      });

      if (rpcError || !rpc?.success) {
        throw new Error(rpcError?.message || rpc?.error || "Error al agregar horas");
      }

      toast.success("Horas agregadas", {
        description: `Hab. ${room.number}: +${hours} hora(s) - ${isCourtesy ? 'Cortesía' : `$${totalPrice.toFixed(2)} MXN`}`,
      });

      // ─── Audit Log ─────────────────────────────────────────────
      logFinancialAction(isCourtesy ? "COURTESY" : "EXTRA_HOUR", {
        roomNumber: room.number,
        amount: totalPrice,
        stayId: activeStay.id,
        salesOrderId: activeStay.sales_order_id,
        description: isCourtesy
          ? `Cortesía: +${hours} hora(s) en Hab. ${room.number}. Motivo: ${courtesyReason || 'Sin motivo'}`
          : `Hora(s) extra: +${hours} en Hab. ${room.number} - $${totalPrice.toFixed(2)}`,
        extra: { hours, is_courtesy: !!isCourtesy, courtesy_reason: courtesyReason },
      });

      // ─── Flow Event ─────────────────────────────────────────────
      findActiveFlow(activeStay.id).then(flowId => {
        if (flowId) {
          logFlowEvent(flowId, {
            event_type: isCourtesy ? "COURTESY_APPLIED" : "EXTRA_HOUR_ADDED",
            description: isCourtesy
              ? `Cortesía: +${hours} hora(s). Motivo: ${courtesyReason || 'Sin motivo'}`
              : `+${hours} hora(s) extra - $${totalPrice.toFixed(2)}`,
            metadata: { hours, amount: totalPrice, is_courtesy: !!isCourtesy, courtesy_reason: courtesyReason },
          });
        }
      });

      if (!isCourtesy && totalPrice > 0) {
        await notifyActiveValets(supabase, '⏰ Cobro de Horas Extra',
          `Habitación ${room.number}: Cobrar ${hours} hora(s) extra ($${totalPrice.toFixed(2)} MXN).`,
          { type: 'NEW_EXTRA', consumptionId: rpc.item_id, roomNumber: room.number, stayId: activeStay.id }
        );
      }
    });
  };

  /**
   * Renovar habitación con precio base
   */
  const handleRenewRoom = async (room: Room) => {
    if (!checkAuthorization("Renovar Habitación")) return;
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No se encontró una estancia activa para esta habitación"); return; }
    if (!room.room_types?.base_price || room.room_types.base_price <= 0) { toast.error("No se configuró el precio base para este tipo"); return; }

    await withAction(ctx, "Error al renovar habitación", async () => {
      const supabase = createClient();
      const basePrice = room.room_types!.base_price!;

      // Calculate renewal hours based on day of week
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      const isWeekendPeriod = (day === 5 && hour >= 6) || (day === 6) || (day === 0 && hour < 6);
      const renewalHours = isWeekendPeriod
        ? (room.room_types!.weekend_hours ?? 4)
        : (room.room_types!.weekday_hours ?? 4);

      const currentShiftId = await getReceptionShiftId(supabase);

      const { data: rpc, error: rpcError } = await supabase.rpc("process_extra_charge", {
        p_stay_id: activeStay.id,
        p_charge_type: "RENEWAL",
        p_amount: basePrice,
        p_quantity: 1,
        p_hours_to_extend: renewalHours,
        p_shift_session_id: currentShiftId,
        p_payment_reference: generatePaymentReference("REN"),
      });

      if (rpcError || !rpc?.success) {
        throw new Error(rpcError?.message || rpc?.error || "Error al renovar habitación");
      }

      toast.success("Habitación renovada", {
        description: `Hab. ${room.number}: Renovación completa - $${basePrice.toFixed(2)} MXN`,
      });

      // ─── Audit Log ─────────────────────────────────────────────
      logFinancialAction("RENEWAL", {
        roomNumber: room.number,
        amount: basePrice,
        stayId: activeStay.id,
        salesOrderId: activeStay.sales_order_id,
        description: `Renovación Hab. ${room.number}: $${basePrice.toFixed(2)} (+${renewalHours}h)`,
        extra: { renewal_hours: renewalHours, is_weekend: isWeekendPeriod },
      });

      // ─── Flow Event ─────────────────────────────────────────────
      findActiveFlow(activeStay.id).then(flowId => {
        if (flowId) {
          logFlowEvent(flowId, {
            event_type: "RENEWAL_APPLIED",
            description: `Renovación: $${basePrice.toFixed(2)} (+${renewalHours}h)`,
            metadata: { amount: basePrice, renewal_hours: renewalHours, is_weekend: isWeekendPeriod },
          });
        }
      });

      await notifyActiveValets(supabase, '🔄 Cobro de Renovación',
        `Habitación ${room.number}: Cobrar renovación ($${basePrice.toFixed(2)} MXN).`,
        { type: 'NEW_EXTRA', consumptionId: rpc.item_id, roomNumber: room.number, stayId: activeStay.id }
      );
    });
  };

  /**
   * Agregar promoción de 4 horas
   */
  const handleAdd4HourPromo = async (room: Room) => {
    if (!checkAuthorization("Aplicar Promoción")) return;
    if (room.status !== "OCUPADA") return;

    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No se encontró una estancia activa para esta habitación"); return; }
    if (!room.room_types?.name) { toast.error("No se encontró el tipo de habitación"); return; }

    await withAction(ctx, "Error al aplicar promoción", async () => {
      const supabase = createClient();

      // Pricing lookup stays on frontend (it's a single read, not a write)
      const { data: pricingData, error: pricingError } = await supabase
        .from('pricing_config').select('price')
        .eq('room_type_name', room.room_types!.name)
        .eq('promo_type', '4H_PROMO').eq('is_active', true).single();

      if (pricingError || !pricingData) {
        toast.error("No hay precio de promoción configurado", { description: `Tipo: ${room.room_types!.name}. Contacta al administrador.` });
        return;
      }

      const promoPrice = pricingData.price;
      const currentShiftId = await getReceptionShiftId(supabase);

      const { data: rpc, error: rpcError } = await supabase.rpc("process_extra_charge", {
        p_stay_id: activeStay.id,
        p_charge_type: "PROMO_4H",
        p_amount: promoPrice,
        p_quantity: 1,
        p_hours_to_extend: 4,
        p_shift_session_id: currentShiftId,
        p_payment_reference: generatePaymentReference("P4H"),
      });

      if (rpcError || !rpc?.success) {
        throw new Error(rpcError?.message || rpc?.error || "Error al aplicar promoción");
      }

      toast.success("Promoción 4 horas aplicada", {
        description: `Hab. ${room.number}: +4 horas - $${promoPrice.toFixed(2)} MXN`,
      });

      // ─── Audit Log ─────────────────────────────────────────────
      logFinancialAction("PROMO_4H", {
        roomNumber: room.number,
        amount: promoPrice,
        stayId: activeStay.id,
        salesOrderId: activeStay.sales_order_id,
        description: `Promo 4H en Hab. ${room.number}: $${promoPrice.toFixed(2)}`,
      });

      await notifyActiveValets(supabase, '🏷️ Cobro de Promoción 4H',
        `Habitación ${room.number}: Cobrar promoción de 4 horas ($${promoPrice.toFixed(2)} MXN).`,
        { type: 'NEW_EXTRA', consumptionId: rpc.item_id, roomNumber: room.number, stayId: activeStay.id }
      );
    });
  };

  return { handleAddDamageCharge, handleAddCustomHours, handleRenewRoom, handleAdd4HourPromo };
}

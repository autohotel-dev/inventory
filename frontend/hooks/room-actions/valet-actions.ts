/**
 * Valet-related room actions: authorize checkout, cancel checkout request, request vehicle.
 */
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room } from "@/components/sales/room-types";
import { notifyActiveValets } from "@/lib/services/valet-notification-service";
import {
  getActiveStay,
  withBoolAction,
  withAction,
  RoomActionContext,
} from "./room-action-helpers";

export function createValetActions(ctx: RoomActionContext) {

  /**
   * Solicitar revisión de vehículo al cochero.
   */
  const requestVehicle = async (stayId: string): Promise<boolean> => {
    return withBoolAction(ctx, "Error al enviar recordatorio", async () => {
      const supabase = createClient();

      const { data: stay, error: stayError } = await supabase
        .from('room_stays')
        .select('valet_employee_id, vehicle_requested_at, vehicle_plate, room:rooms(number)')
        .eq('id', stayId)
        .single();

      if (stayError || !stay) throw new Error("No se encontró la estancia");

      if (!stay.vehicle_requested_at) {
        await supabase.from('room_stays')
          .update({ vehicle_requested_at: new Date().toISOString() })
          .eq('id', stayId);
      }

      const roomNumber = (stay.room as any)?.number || "Desconocida";
      const hasPlate = !!stay.vehicle_plate;
      const isResend = !!stay.vehicle_requested_at;

      await notifyActiveValets(supabase,
        hasPlate ? '🚗 Solicitar Revisión' : '🚗 Registro Pendiente',
        hasPlate
          ? `${isResend ? '🔔 RECORDATORIO: ' : ''}Recepción solicita revisión del vehículo Hab. ${roomNumber} (Placas: ${stay.vehicle_plate})`
          : `Recepción te recuerda registrar el vehículo de la Habitación ${roomNumber}`,
        { type: hasPlate ? 'VEHICLE_REQUEST' : 'system_alert', stay_id: stayId, room_number: roomNumber }
      );

      toast.success(isResend ? "Recordatorio re-enviado al cochero 🔔" : "Solicitud enviada al cochero 🔔");
      return true;
    });
  };

  /**
   * Autorizar salida del cochero para checkout.
   */
  const handleAuthorizeValetCheckout = async (room: Room): Promise<boolean> => {
    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No hay estancia activa"); return false; }

    return withBoolAction(ctx, "Error al autorizar la salida", async () => {
      const supabase = createClient();

      await supabase.from('room_stays')
        .update({ vehicle_requested_at: new Date().toISOString() })
        .eq('id', activeStay.id);

      await notifyActiveValets(supabase, '✅ Salida Autorizada',
        `Habitación ${room.number}: Recepción autorizó la salida.`,
        { type: 'CHECKOUT_REQUEST', stayId: activeStay.id, roomNumber: room.number }
      );

      toast.success("Salida autorizada ✅");
      await ctx.onRefresh();
      return true;
    });
  };

  /**
   * Cancelar solicitud de checkout del cochero.
   */
  const handleCancelValetCheckout = async (room: Room): Promise<boolean> => {
    const activeStay = getActiveStay(room);
    if (!activeStay) { toast.error("No hay estancia activa"); return false; }

    return withBoolAction(ctx, "Error al cancelar la solicitud", async () => {
      const supabase = createClient();

      await supabase.from('room_stays').update({
        valet_checkout_requested_at: null,
        vehicle_requested_at: null,
        checkout_valet_employee_id: null
      }).eq('id', activeStay.id);

      await notifyActiveValets(supabase, '🚫 Solicitud Cancelada',
        `Recepción canceló la solicitud de salida de la Habitación ${room.number}.`,
        { type: 'CHECKOUT_CANCELLED', stayId: activeStay.id, roomNumber: room.number }
      );

      toast.success("Solicitud cancelada correctamente");
      await ctx.onRefresh();
      return true;
    });
  };

  return { requestVehicle, handleAuthorizeValetCheckout, handleCancelValetCheckout };
}

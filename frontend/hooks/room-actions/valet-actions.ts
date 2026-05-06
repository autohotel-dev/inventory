import { apiClient } from "@/lib/api/client";
/**
 * Valet-related room actions: authorize checkout, cancel checkout request, request vehicle.
 */
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
      const { apiClient } = await import("@/lib/api/client");
      let stay;
      try {
        const res1 = await apiClient.get(`/system/crud/room_stays/${stayId}`);
        stay = res1.data;
      } catch (e) {
        throw new Error("No se encontró la estancia");
      }
      
      let roomNumber = "Desconocida";
      if (stay.room_id) {
        try {
          const res2 = await apiClient.get(`/system/crud/rooms/${stay.room_id}`);
          roomNumber = res2.data?.number || "Desconocida";
        } catch(e) {}
      }

      if (!stay.vehicle_requested_at) {
        const { apiClient } = await import("@/lib/api/client");
        await apiClient.patch(`/rooms/stays/${stayId}`, {
          vehicle_requested_at: new Date().toISOString()
        });
      }

      const hasPlate = !!stay.vehicle_plate;
      const isResend = !!stay.vehicle_requested_at;

      await notifyActiveValets(
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

      const { apiClient } = await import("@/lib/api/client");
      await apiClient.patch(`/rooms/stays/${activeStay.id}`, {
        vehicle_requested_at: new Date().toISOString()
      });

      await notifyActiveValets('✅ Salida Autorizada',
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

      const { apiClient } = await import("@/lib/api/client");
      await apiClient.patch(`/rooms/stays/${activeStay.id}`, {
        valet_checkout_requested_at: null,
        vehicle_requested_at: null,
        checkout_valet_employee_id: null
      });

      await notifyActiveValets('🚫 Solicitud Cancelada',
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

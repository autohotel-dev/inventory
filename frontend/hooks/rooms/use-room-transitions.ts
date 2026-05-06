import { apiClient } from "@/lib/api/client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Room } from "@/components/sales/room-types";
import { notifyActiveValets } from "@/lib/services/valet-notification-service";
import { EXIT_TOLERANCE_MS } from "@/lib/constants/room-constants";
import { toast } from "sonner";

// Utilidad auxiliar pura sin estado, es extraída del board
export const getActiveStayForTransitions = (room: Room) => {
  return (room.room_stays || []).find((stay) => stay.status === "ACTIVA") || null;
};

/**
 * Hook responsable de correr la rutina de evaluación minuto a minuto (CronJob).
 * Esto procesa automáticamente el añadido de horas extra en base de datos.
 */
export function useRoomTransitions(
  rooms: Room[],
  fetchRooms: (showLoading?: boolean) => Promise<void>
) {
  useEffect(() => {
    const processRoomTransitions = async () => {
      const supabase = createClient();
      const now = new Date();

      for (const room of rooms) {
        if (room.status === "OCUPADA" && !room.room_types?.is_hotel) {
          const activeStay = getActiveStayForTransitions(room);
          if (!activeStay || !activeStay.expected_check_out_at) continue;

          const expected = new Date(activeStay.expected_check_out_at);
          const diffMs = now.getTime() - expected.getTime();

          // Solo llamamos al RPC si parece que ya pasó la tolerancia
          if (diffMs > EXIT_TOLERANCE_MS) {
            try {
              const { apiClient } = await import("@/lib/api/client");
              const response = await apiClient.post(`/rooms/${room.id}/extra-hours`, {
                stay_id: activeStay.id
              });
              const data = response.data;

              if (data && data.success && data.hours_added > 0) {
                console.log(`⏰ [AUTO EXTRA HOUR] Hab. ${room.number}: +${data.hours_added}h (vía RPC).`);

                // Notificar a los valets
                await notifyActiveValets(
                  supabase,
                  '⏰ Horas Extra Agregadas',
                  `Habitación ${room.number}: Se agregaron ${data.hours_added}h extra. Saldo actualizado.`,
                  {
                    type: 'EXTRA_HOUR_ADDED',
                    roomNumber: room.number,
                    stayId: activeStay.id
                  }
                );

                await fetchRooms(true);
                toast.info(`Hab. ${room.number}: +${data.hours_added}h extra cobrada(s).`);
              }
            } catch (err) {
              console.error(`[RPC EXTRA HOUR] Exception en Hab. ${room.number}:`, err);
            }
          }
        }
      }
    };

    const interval = setInterval(processRoomTransitions, 60000);
    processRoomTransitions();
    return () => clearInterval(interval);
  }, [rooms, fetchRooms]);
}

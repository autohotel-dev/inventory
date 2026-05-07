import { apiClient } from "@/lib/api/client";
import { useEffect, useRef } from "react";
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
  const roomsRef = useRef(rooms);
  const fetchRoomsRef = useRef(fetchRooms);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    roomsRef.current = rooms;
    fetchRoomsRef.current = fetchRooms;
  }, [rooms, fetchRooms]);

  useEffect(() => {
    const processRoomTransitions = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      try {
        const now = new Date();
        const currentRooms = roomsRef.current;

        for (const room of currentRooms) {
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
                    '⏰ Horas Extra Agregadas',
                    `Habitación ${room.number}: Se agregaron ${data.hours_added}h extra. Saldo actualizado.`,
                    {
                      type: 'EXTRA_HOUR_ADDED',
                      roomNumber: room.number,
                      stayId: activeStay.id
                    }
                  );

                  await fetchRoomsRef.current(true);
                  toast.info(`Hab. ${room.number}: +${data.hours_added}h extra cobrada(s).`);
                }
              } catch (err) {
                console.error(`[RPC EXTRA HOUR] Exception en Hab. ${room.number}:`, err);
              }
            }
          }
        }
      } finally {
        isProcessingRef.current = false;
      }
    };

    const interval = setInterval(processRoomTransitions, 60000); // 1 minuto exacto
    // No invocar instantáneamente, evitar spam. Dejar que corra al minuto.
    return () => clearInterval(interval);
  }, []);
}

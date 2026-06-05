import { useEffect, useRef, useCallback } from "react";
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
 *
 * Uses refs for rooms/fetchRooms so the interval is created ONCE
 * and never torn down when rooms data changes via Realtime.
 */
export function useRoomTransitions(
  rooms: Room[],
  fetchRooms: (showLoading?: boolean) => Promise<void>
) {
  const roomsRef = useRef(rooms);
  const fetchRoomsRef = useRef(fetchRooms);

  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { fetchRoomsRef.current = fetchRooms; }, [fetchRooms]);

  const processRoomTransitions = useCallback(async () => {
    const supabase = createClient();
    const now = new Date();

    for (const room of roomsRef.current) {
      if (room.status === "OCUPADA" && !room.room_types?.is_hotel) {
        const activeStay = getActiveStayForTransitions(room);
        if (!activeStay || !activeStay.expected_check_out_at) continue;

        const expected = new Date(activeStay.expected_check_out_at);
        const diffMs = now.getTime() - expected.getTime();

        // Solo llamamos al RPC si parece que ya pasó la tolerancia
        if (diffMs > EXIT_TOLERANCE_MS) {
          try {
            const { data, error } = await supabase.rpc('process_extra_hours_v2', {
              p_stay_id: activeStay.id
            });

            if (error) {
              console.error(`[RPC EXTRA HOUR] Error en Hab. ${room.number}:`, error);
              continue;
            }

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

              await fetchRoomsRef.current(true);
              toast.info(`Hab. ${room.number}: +${data.hours_added}h extra cobrada(s).`);
            }
          } catch (err) {
            console.error(`[RPC EXTRA HOUR] Exception en Hab. ${room.number}:`, err);
          }
        }
      }
    }
  }, []);

  // Run immediately on mount, then every 60s — stable, never restarted
  useEffect(() => {
    processRoomTransitions();
    const interval = setInterval(processRoomTransitions, 60000);
    return () => clearInterval(interval);
  }, [processRoomTransitions]);
}


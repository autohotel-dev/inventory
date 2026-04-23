import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook dedicado a la suscripción de eventos en tiempo real (Supabase WebSockets).
 * Mantiene la conexión viva y desencadena acciones locales como el refresco o las alertas.
 * 
 * Usa useRef para las callbacks para evitar loops de mount/unmount
 * cuando fetchRooms o playAlert cambian de referencia.
 */
export function useRoomRealtime(
  fetchRooms: (showLoading?: boolean) => Promise<void>,
  playAlert: () => void
) {
  // Refs estables para evitar re-suscripciones innecesarias
  const fetchRoomsRef = useRef(fetchRooms);
  const playAlertRef = useRef(playAlert);

  // Mantener refs actualizados sin causar re-renders
  useEffect(() => { fetchRoomsRef.current = fetchRooms; }, [fetchRooms]);
  useEffect(() => { playAlertRef.current = playAlert; }, [playAlert]);

  useEffect(() => {
    const supabase = createClient();
    let isSubscribed = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtimeChannel = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        } else {
          console.warn("⚠️ [Realtime] No hay sesión activa");
        }

        channel = supabase
          .channel("rooms-board-realtime")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "rooms" },
            () => {
              if (!isSubscribed) return;
              fetchRoomsRef.current(true);
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "room_assets" },
            () => {
              if (!isSubscribed) return;
              fetchRoomsRef.current(true);
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "room_stays" },
            () => {
              if (!isSubscribed) return;
              fetchRoomsRef.current(true);
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "payments" },
            () => {
              if (!isSubscribed) return;
              fetchRoomsRef.current(true);
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "sales_orders" },
            () => {
              if (!isSubscribed) return;
              fetchRoomsRef.current(true);
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "sales_order_items" },
            (payload: any) => {
              if (!isSubscribed) return;

              // Alerta sonora para nuevos pedidos de consumo
              if (payload.eventType === "INSERT" && payload.new?.concept_type === "CONSUMPTION") {
                playAlertRef.current();
              }

              fetchRoomsRef.current(true);
            }
          )
          .subscribe((status: string, err?: Error) => {
            if (status === "SUBSCRIBED") {
              console.log("✅ [Realtime] Conexión activada");
            } else if (status === "CHANNEL_ERROR") {
              console.warn("⚠️ [Realtime] Error en canal:", err?.message || "");
            } else if (status === "TIMED_OUT") {
              console.warn("⏱️ [Realtime] Timeout");
            }
          });
      } catch (error) {
        console.error("❌ [Realtime] Error configurando:", error);
      }
    };

    setupRealtimeChannel();

    return () => {
      isSubscribed = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []); // Sin dependencias → se monta UNA sola vez
}

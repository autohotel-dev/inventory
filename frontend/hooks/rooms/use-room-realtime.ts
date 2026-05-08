import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook dedicado a la suscripción de eventos en tiempo real (Supabase WebSockets).
 * Mantiene la conexión viva y desencadena acciones locales como el refresco o las alertas.
 * 
 * Uses useRef for callbacks to avoid loops of mount/unmount
 * when fetchRooms or playAlert change reference.
 * 
 * Performance: All table change events are debounced with 300ms to coalesce
 * multiple simultaneous changes (e.g. checkout touches 4+ tables at once).
 */
export function useRoomRealtime(
  fetchRooms: (showLoading?: boolean) => Promise<void>,
  playAlert: () => void
) {
  // Refs estables para evitar re-suscripciones innecesarias
  const fetchRoomsRef = useRef(fetchRooms);
  const playAlertRef = useRef(playAlert);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Mantener refs actualizados sin causar re-renders
  useEffect(() => { fetchRoomsRef.current = fetchRooms; }, [fetchRooms]);
  useEffect(() => { playAlertRef.current = playAlert; }, [playAlert]);

  useEffect(() => {
    const supabase = createClient();
    let isSubscribed = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Debounced fetch: coalesces multiple realtime events into 1 refetch
    // 600ms is enough to group checkout (touches 4+ tables) into a single refetch
    const debouncedFetch = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (isSubscribed) fetchRoomsRef.current(true);
      }, 600);
    };

    const setupRealtimeChannel = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        } else {
          console.warn("⚠️ [Realtime] No hay sesión activa");
        }

        // Remove any pre-existing channel with the same name to prevent
        // "cannot add callbacks after subscribe()" during StrictMode/hot reload
        const existingChannel = supabase.channel("rooms-board-realtime");
        await supabase.removeChannel(existingChannel);

        channel = supabase
          .channel("rooms-board-realtime")
          // Core tables that directly affect the room dashboard visuals
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "rooms" },
            () => { if (isSubscribed) debouncedFetch(); }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "room_assets" },
            () => { if (isSubscribed) debouncedFetch(); }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "room_stays" },
            () => { if (isSubscribed) debouncedFetch(); }
          )
          // sales_orders for remaining_amount changes
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "sales_orders" },
            () => { if (isSubscribed) debouncedFetch(); }
          )
          // sales_order_items only for new CONSUMPTION items (sound alert)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "sales_order_items" },
            (payload: any) => {
              if (!isSubscribed) return;
              if (payload.new?.concept_type === "CONSUMPTION") {
                playAlertRef.current();
              }
              debouncedFetch();
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
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []); // Sin dependencias → se monta UNA sola vez
}

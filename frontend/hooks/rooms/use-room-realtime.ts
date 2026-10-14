import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { invalidateReceptionCache } from "@/hooks/room-actions/shift-helpers";
import { subscribeResilient } from "@/lib/supabase/resilient-channel";

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

    // Debounced fetch: coalesces multiple realtime events into 1 refetch
    // 600ms is enough to group checkout (touches 4+ tables) into a single refetch
    const debouncedFetch = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (isSubscribed) fetchRoomsRef.current(true);
      }, 600);
    };

    const unsubscribe = subscribeResilient(
      supabase,
      "rooms-board-realtime",
      (channel) => channel
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
        // Invalidate reception shift cache when shifts change
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "shift_sessions" },
          () => {
            if (!isSubscribed) return;
            // Invalidate the cached reception context so next charge uses the correct shift
            invalidateReceptionCache();
            debouncedFetch();
          }
        ),
      // (Re)conectado: los cambios ocurridos mientras el canal estaba caído no llegan, recargar
      () => { if (isSubscribed) debouncedFetch(); }
    );

    return () => {
      isSubscribed = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      unsubscribe();
    };
  }, []); // Sin dependencias → se monta UNA sola vez
}

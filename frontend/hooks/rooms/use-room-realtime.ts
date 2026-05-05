import { useEffect, useRef } from "react";
import { luxorRealtimeClient } from "@/lib/api/websocket";

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
    let isSubscribed = true;

    // Debounced fetch: coalesces multiple realtime events into 1 refetch
    const debouncedFetch = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (isSubscribed) fetchRoomsRef.current(true);
      }, 300);
    };

    const handleGenericUpdate = () => {
      if (!isSubscribed) return;
      debouncedFetch();
    };

    const handleSalesOrderItems = (payload: any) => {
      if (!isSubscribed) return;
      // Alerta sonora para nuevos pedidos de consumo
      if (payload.type === "INSERT" && payload.record?.concept_type === "CONSUMPTION") {
        playAlertRef.current();
      }
      debouncedFetch();
    };

    const unsubRooms = luxorRealtimeClient.subscribe("rooms", handleGenericUpdate);
    const unsubAssets = luxorRealtimeClient.subscribe("room_assets", handleGenericUpdate);
    const unsubStays = luxorRealtimeClient.subscribe("room_stays", handleGenericUpdate);
    const unsubPayments = luxorRealtimeClient.subscribe("payments", handleGenericUpdate);
    const unsubSales = luxorRealtimeClient.subscribe("sales_orders", handleGenericUpdate);
    const unsubItems = luxorRealtimeClient.subscribe("sales_order_items", handleSalesOrderItems);

    return () => {
      isSubscribed = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      unsubRooms();
      unsubAssets();
      unsubStays();
      unsubPayments();
      unsubSales();
      unsubItems();
    };
  }, []); // Sin dependencias → se monta UNA sola vez
}

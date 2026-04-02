import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook dedicado a la suscripción de eventos en tiempo real (Supabase WebSockets).
 * Mantiene la conexión viva y desencadena acciones locales como el refresco o las alertas.
 */
export function useRoomRealtime(
  fetchRooms: (showLoading?: boolean) => Promise<void>,
  playAlert: () => void
) {
  useEffect(() => {
    const supabase = createClient();
    let isSubscribed = true;
    let channel: any = null;

    console.log("🔌 [useRoomRealtime] Configurando suscripción en tiempo real...");

    // Función para configurar el canal con autenticación
    const setupRealtimeChannel = async () => {
      try {
        // Obtener sesión actual y configurar auth para Realtime
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          // IMPORTANTE: Vincular el token de auth al cliente Realtime
          supabase.realtime.setAuth(session.access_token);
          console.log("🔑 [useRoomRealtime] Token de autenticación configurado para Realtime");
        } else {
          console.warn("⚠️ [useRoomRealtime] No hay sesión activa - Realtime puede fallar con RLS");
        }

        channel = supabase
          .channel("rooms-board-realtime")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "rooms" },
            (payload: any) => {
              if (!isSubscribed) return;
              console.log("📡 [useRoomRealtime] Cambio detectado en 'rooms':", {
                event: payload.eventType,
                roomId: payload.new?.id || payload.old?.id,
                status: payload.new?.status || payload.old?.status,
              });
              fetchRooms(true);
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "room_stays" },
            (payload: any) => {
              if (!isSubscribed) return;
              console.log("📡 [useRoomRealtime] Cambio detectado en 'room_stays':", {
                event: payload.eventType,
                stayId: payload.new?.id || payload.old?.id,
                vehiclePlate: payload.new?.vehicle_plate,
                valetId: payload.new?.valet_employee_id,
                checkoutValetId: payload.new?.checkout_valet_employee_id,
                valetCheckoutRequested: payload.new?.valet_checkout_requested_at,
              });
              fetchRooms(true);
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "payments" },
            (payload: any) => {
              if (!isSubscribed) return;
              console.log("📡 [useRoomRealtime] Cambio detectado en 'payments':", {
                event: payload.eventType,
                paymentId: payload.new?.id || payload.old?.id,
                status: payload.new?.status,
              });
              fetchRooms(true);
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "sales_orders" },
            (payload: any) => {
              if (!isSubscribed) return;
              console.log("📡 [useRoomRealtime] Cambio detectado en 'sales_orders':", {
                event: payload.eventType,
                orderId: payload.new?.id || payload.old?.id,
              });
              fetchRooms(true);
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "sales_order_items" },
            (payload: any) => {
              if (!isSubscribed) return;
              console.log("📡 [useRoomRealtime] Cambio detectado en 'sales_order_items':", {
                event: payload.eventType,
                itemId: payload.new?.id || payload.old?.id,
                concept: payload.new?.concept_type,
              });

              // Alerta sonora para nuevos pedidos de consumo
              if (payload.eventType === "INSERT" && payload.new?.concept_type === "CONSUMPTION") {
                console.log("🔔 [useRoomRealtime] ¡Nuevo consumo detectado! Reproduciendo alerta...");
                playAlert();
              }

              fetchRooms(true);
            }
          )
          .subscribe((status: string, err?: Error) => {
            // Reaccionar al estado real de la conexión
            if (status === "SUBSCRIBED") {
              console.log("✅ [useRoomRealtime] Conexión en tiempo real ACTIVADA");
            } else if (status === "CHANNEL_ERROR") {
              console.warn("⚠️ [useRoomRealtime] Error en canal Realtime", err?.message || "");
            } else if (status === "TIMED_OUT") {
              console.warn("⏱️ [useRoomRealtime] Timeout de conexión");
            } else if (status === "CLOSED") {
              console.log("🚪 [useRoomRealtime] Conexión cerrada");
            }
          });
      } catch (error) {
        console.error("❌ [useRoomRealtime] Error configurando Realtime:", error);
      }
    };

    // Ejecutar la configuración
    setupRealtimeChannel();

    // Cleanup function
    return () => {
      isSubscribed = false;
      console.log("🔌 [useRoomRealtime] Cerrando suscripción en tiempo real...");
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchRooms, playAlert]); // incluimos dependencias estables
}

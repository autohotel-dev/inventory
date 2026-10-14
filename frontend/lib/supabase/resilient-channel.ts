import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Suscripción Realtime que se recupera sola.
 *
 * Supabase puede rechazar o tirar una suscripción (create_subscription timeout,
 * "Too many channels", token expirado, PC suspendida). Por defecto el canal se
 * queda muerto en silencio y la pantalla deja de recibir cambios hasta que alguien
 * recarga a mano. Aquí:
 *   - CHANNEL_ERROR / TIMED_OUT / CLOSED inesperado → se quita el canal y se vuelve
 *     a crear con backoff (1s, 2s, 4s… hasta 30s).
 *   - Cada SUBSCRIBED llama a onSubscribed: los eventos perdidos durante el corte no
 *     se reenvían, así que la pantalla debe recargar sus datos en ese momento.
 *   - Volver a la pestaña o recuperar la red fuerza una reconexión si el canal no
 *     está unido, y siempre llama a onSubscribed para ponerse al día.
 */
export function subscribeResilient(
  supabase: SupabaseClient,
  name: string,
  configure: (channel: RealtimeChannel) => RealtimeChannel,
  onSubscribed?: () => void
): () => void {
  let channel: RealtimeChannel | null = null;
  let stopped = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleRetry = () => {
    if (stopped || retryTimer) return;
    const delay = Math.min(30_000, 1_000 * 2 ** attempt);
    attempt++;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  };

  const connect = async () => {
    if (stopped) return;
    if (channel) {
      const old = channel;
      channel = null;
      await supabase.removeChannel(old);
    }
    if (stopped) return;

    // Sin setAuth(token) manual: fija el token y deja de seguir las renovaciones de
    // supabase-js; el cliente ya pasa el token vigente a Realtime en cada refresh.
    const current = configure(supabase.channel(name));
    channel = current;
    current.subscribe((status: string, err?: Error) => {
      if (stopped || channel !== current) return;
      if (status === "SUBSCRIBED") {
        attempt = 0;
        onSubscribed?.();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.warn(`⚠️ [Realtime:${name}] ${status}`, err?.message || "", "→ reintentando");
        scheduleRetry();
      }
    });
  };

  const resync = () => {
    if (stopped) return;
    if (document.visibilityState !== "visible") return;
    if (channel?.state !== "joined") {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      attempt = 0;
      connect();
    } else {
      onSubscribed?.();
    }
  };

  window.addEventListener("online", resync);
  window.addEventListener("supabase-reconnect", resync);
  document.addEventListener("visibilitychange", resync);

  connect();

  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    window.removeEventListener("online", resync);
    window.removeEventListener("supabase-reconnect", resync);
    document.removeEventListener("visibilitychange", resync);
    if (channel) supabase.removeChannel(channel);
    channel = null;
  };
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeConnection() {
  const [isConnected, setIsConnected] = useState(true);
  const [isTabActive, setIsTabActive] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Set initial state
    setIsConnected(typeof window !== "undefined" ? window.navigator.onLine : true);

    const handleOnline = () => {
      setIsConnected(true);
      window.dispatchEvent(new CustomEvent("supabase-reconnect"));
    };
    
    const handleOffline = () => setIsConnected(false);

    // Visibility change handling (Sleep/Wake)
    const handleVisibilityChange = () => {
      const active = document.visibilityState === "visible";
      setIsTabActive(active);

      if (active) {
        // Cuando vuelve a estar visible (ej. se despertó la PC), verificamos línea
        if (window.navigator.onLine) {
          setIsConnected(true);
          // Forzar a los componentes a re-traer datos para no tener desincronización
          window.dispatchEvent(new CustomEvent("supabase-reconnect"));
        } else {
          setIsConnected(false);
        }
      }
    };

    // Keep-alive channel to monitor Supabase socket health
    const channel = supabase.channel('system-keep-alive');
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
      } else if (status === 'CHANNEL_ERROR') {
        setIsConnected(false);
      }
    });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return { isConnected, isTabActive };
}

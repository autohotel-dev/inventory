"use client";

import { useEffect, useState } from "react";

export function useRealtimeConnection() {
  const [isConnected, setIsConnected] = useState(true);
  const [isTabActive, setIsTabActive] = useState(true);

  useEffect(() => {
    // Set initial state
    setIsConnected(typeof window !== "undefined" ? window.navigator.onLine : true);

    const handleOnline = () => {
      setIsConnected(true);
      window.dispatchEvent(new CustomEvent("supabase-reconnect")); // Keep event name for backward compatibility
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

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return { isConnected, isTabActive };
}

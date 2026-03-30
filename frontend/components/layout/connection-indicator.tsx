"use client";

import { useRealtimeConnection } from "@/hooks/use-realtime-connection";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConnectionIndicator() {
  const { isConnected } = useRealtimeConnection();

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors duration-300",
        isConnected
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-500 animate-pulse"
      )}
      title={isConnected ? "Conectado al servidor" : "Sin conexión - Sincronización en pausa"}
    >
      <div
        className={cn(
          "w-2 h-2 rounded-full",
          isConnected ? "bg-green-500" : "bg-red-500"
        )}
      />
      <span className="hidden sm:inline-block">
        {isConnected ? "Conectado" : "Desconectado"}
      </span>
      {isConnected ? (
        <Wifi className="w-3.5 h-3.5 sm:hidden" />
      ) : (
        <WifiOff className="w-3.5 h-3.5 sm:hidden" />
      )}
    </div>
  );
}

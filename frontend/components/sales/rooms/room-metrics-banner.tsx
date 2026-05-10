"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Room } from "@/components/sales/room-types";

interface RoomMetricsBannerProps {
  rooms: Room[];
}

export function RoomMetricsBanner({ rooms }: RoomMetricsBannerProps) {
  const counts = useMemo(() => {
    const init = { libre: 0, ocupada: 0, sucia: 0, bloqueada: 0, limpiando: 0 };
    rooms.forEach((r) => {
      switch (r.status) {
        case "LIBRE": init.libre++; break;
        case "OCUPADA": init.ocupada++; break;
        case "SUCIA": init.sucia++; break;
        case "BLOQUEADA": init.bloqueada++; break;
        case "LIMPIANDO": init.limpiando++; break;
      }
    });
    return init;
  }, [rooms]);

  return (
    <div className="space-y-4">
      {/* Mini-dashboard de contadores por estado */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-sm">
          <CardContent className="py-2 sm:py-3 px-1 sm:px-4 flex flex-col gap-0.5 sm:gap-1 items-center justify-center text-center">
            <span className="text-[9px] sm:text-xs font-medium text-emerald-500 uppercase tracking-wider truncate w-full">Libres</span>
            <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {counts.libre}
            </span>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5 shadow-sm">
          <CardContent className="py-2 sm:py-3 px-1 sm:px-4 flex flex-col gap-0.5 sm:gap-1 items-center justify-center text-center">
            <span className="text-[9px] sm:text-xs font-medium text-red-500 uppercase tracking-wider truncate w-full">Ocupadas</span>
            <span className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">
              {counts.ocupada}
            </span>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20 bg-purple-500/5 shadow-sm">
          <CardContent className="py-2 sm:py-3 px-1 sm:px-4 flex flex-col gap-0.5 sm:gap-1 items-center justify-center text-center">
            <span className="text-[9px] sm:text-xs font-medium text-purple-500 uppercase tracking-wider truncate w-full">Sucias</span>
            <span className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
              {counts.sucia}
            </span>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5 shadow-sm">
          <CardContent className="py-2 sm:py-3 px-1 sm:px-4 flex flex-col gap-0.5 sm:gap-1 items-center justify-center text-center">
            <span className="text-[9px] sm:text-xs font-medium text-amber-500 uppercase tracking-wider truncate w-full">Bloqueadas</span>
            <span className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
              {counts.bloqueada}
            </span>
          </CardContent>
        </Card>
        <Card className="border-cyan-500/20 bg-cyan-500/5 shadow-sm">
          <CardContent className="py-2 sm:py-3 px-1 sm:px-4 flex flex-col gap-0.5 sm:gap-1 items-center justify-center text-center">
            <span className="text-[9px] sm:text-xs font-medium text-cyan-500 uppercase tracking-wider truncate w-full">Limpiando</span>
            <span className="text-xl sm:text-2xl font-bold text-cyan-600 dark:text-cyan-400">
              {counts.limpiando}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Leyenda de estados y tipos - Responsive Fix */}
      <div className="bg-muted/30 p-3 rounded-lg border border-border/50 flex flex-wrap gap-x-8 gap-y-3 justify-center text-xs text-muted-foreground">
        {/* Estados */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-foreground/80">Estados:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
            <span>Libre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
            <span>Ocupada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm" />
            <span>Sucia</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
            <span>Bloqueada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-sm" />
            <span>Limpiando</span>
          </div>
        </div>

        {/* Tipos de Estancia */}
        <div className="flex items-center gap-4">
          <span className="font-semibold text-foreground/80">Tipos de Estancia:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full border-2 border-primary/40" />
            <span>Hospedaje</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full border-[3px] border-primary/80" />
            <span>Motel</span>
          </div>
        </div>
      </div>
    </div>
  );
}

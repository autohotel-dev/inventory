"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Room } from "@/components/sales/room-types";

interface RoomMetricsBannerProps {
  rooms: Room[];
}

export function RoomMetricsBanner({ rooms }: RoomMetricsBannerProps) {
  return (
    <div className="space-y-4">
      {/* Mini-dashboard de contadores por estado */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-blue-500/20 bg-blue-500/5 shadow-sm">
          <CardContent className="py-3 px-4 flex flex-col gap-1 items-center justify-center text-center">
            <span className="text-xs font-medium text-blue-500 uppercase tracking-wider">Libres</span>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {rooms.filter((r) => r.status === "LIBRE").length}
            </span>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5 shadow-sm">
          <CardContent className="py-3 px-4 flex flex-col gap-1 items-center justify-center text-center">
            <span className="text-xs font-medium text-red-500 uppercase tracking-wider">Ocupadas</span>
            <span className="text-2xl font-bold text-red-600 dark:text-red-400">
              {rooms.filter((r) => r.status === "OCUPADA").length}
            </span>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20 bg-purple-500/5 shadow-sm">
          <CardContent className="py-3 px-4 flex flex-col gap-1 items-center justify-center text-center">
            <span className="text-xs font-medium text-purple-500 uppercase tracking-wider">Sucias</span>
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {rooms.filter((r) => r.status === "SUCIA").length}
            </span>
          </CardContent>
        </Card>
        <Card className="border-green-500/20 bg-green-500/5 shadow-sm">
          <CardContent className="py-3 px-4 flex flex-col gap-1 items-center justify-center text-center">
            <span className="text-xs font-medium text-green-500 uppercase tracking-wider">Bloqueadas</span>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {rooms.filter((r) => r.status === "BLOQUEADA").length}
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
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
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
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" />
            <span>Bloqueada</span>
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

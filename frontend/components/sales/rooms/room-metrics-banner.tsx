"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Room } from "@/components/sales/room-types";
import { DoorOpen, DoorClosed, WifiOff, CircleHelp } from "lucide-react";
import { type Sensor, getSensorsByRoom, getDoorState, getSignalState, isLowBattery, isSensorServiceDown } from "@/lib/sensors/sensor-state";

interface RoomMetricsBannerProps {
  rooms: Room[];
  sensors?: Sensor[];
  /** Reloj de useSensors() */
  now: number;
}

export function RoomMetricsBanner({ rooms, sensors = [], now }: RoomMetricsBannerProps) {
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

  const sensorStats = useMemo(() => {
    if (!sensors.length) return null;
    const statusByRoom = new Map(rooms.map(r => [r.id, r.status]));
    const roomSensors = [...getSensorsByRoom(sensors, now).values()].filter(s => statusByRoom.has(s.room_id!));
    let openInOccupied = 0, online = 0, unknown = 0, noSignal = 0, lowBattery = 0;
    for (const s of roomSensors) {
      const signal = getSignalState(s, now);
      const door = getDoorState(s);
      if (signal === "ONLINE") {
        online++;
        if (door === "OPEN" && statusByRoom.get(s.room_id!) === "OCUPADA") openInOccupied++;
        if (door === "UNKNOWN") unknown++;
      } else {
        noSignal++;
      }
      if (isLowBattery(s)) lowBattery++;
    }
    return {
      openInOccupied, online, unknown, noSignal, lowBattery,
      total: roomSensors.length,
      serviceDown: isSensorServiceDown(sensors, now),
    };
  }, [sensors, rooms, now]);

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

      {/* Sensor metrics strip — always rendered with fixed height to prevent layout shift */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-2.5 min-h-[40px]">
        <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-zinc-500 mr-1">Sensores</span>

        {sensorStats?.serviceDown ? (
          <div className="flex items-center gap-1.5 text-red-400">
            <WifiOff className="h-3.5 w-3.5" />
            <span className="text-xs font-bold">Servicio de sensores sin señal — las alertas de cochera están pausadas</span>
          </div>
        ) : sensorStats ? (
          <>
            <div className="flex items-center gap-1.5" title="Cocheras abiertas en habitaciones ocupadas">
              <DoorOpen className={`h-3.5 w-3.5 ${sensorStats.openInOccupied > 0 ? 'text-red-400' : 'text-zinc-500'}`} />
              <span className={`text-xs font-bold ${sensorStats.openInOccupied > 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                {sensorStats.openInOccupied} {sensorStats.openInOccupied === 1 ? 'abierta' : 'abiertas'} en ocupadas
              </span>
            </div>

            <div className="w-px h-4 bg-white/10" />

            <div className="flex items-center gap-1.5">
              <span className="text-sm">📡</span>
              <span className={`text-xs font-bold ${sensorStats.online === sensorStats.total ? 'text-emerald-400' : 'text-amber-400'}`}>
                {sensorStats.online}/{sensorStats.total} en línea
              </span>
            </div>

            {sensorStats.noSignal > 0 && (
              <>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5" title="Sensores que su hub no ve o que dejaron de reportar">
                  <WifiOff className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="text-xs font-bold text-zinc-400">{sensorStats.noSignal} sin señal</span>
                </div>
              </>
            )}

            {sensorStats.unknown > 0 && (
              <>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5" title="El hub aún no conoce su estado; se actualiza la próxima vez que la cochera se mueva">
                  <CircleHelp className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-xs font-bold text-zinc-500">{sensorStats.unknown} sin dato</span>
                </div>
              </>
            )}

            {sensorStats.lowBattery > 0 && (
              <>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🔋</span>
                  <span className="text-xs font-bold text-amber-400">
                    {sensorStats.lowBattery} baja
                  </span>
                </div>
              </>
            )}
          </>
        ) : (
          <span className="text-xs text-zinc-600">Cargando...</span>
        )}
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
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#2c1a0a] ring-1 ring-yellow-800/50 shadow-sm" />
            <span>Saliendo</span>
          </div>
        </div>

        {/* Cochera (pastilla en la esquina inferior izquierda de cada tarjeta) */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-foreground/80">Cochera:</span>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-sky-600 p-0.5 text-white"><DoorOpen className="h-2.5 w-2.5" /></span>
            <span>Abierta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-red-600 p-0.5 text-white"><DoorOpen className="h-2.5 w-2.5" /></span>
            <span>Abierta en ocupada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-zinc-900 p-0.5 text-emerald-400"><DoorClosed className="h-2.5 w-2.5" /></span>
            <span>Cerrada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-zinc-800 p-0.5 text-zinc-400"><CircleHelp className="h-2.5 w-2.5" /></span>
            <span>Sin dato</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-zinc-700 p-0.5 text-zinc-300"><WifiOff className="h-2.5 w-2.5" /></span>
            <span>Sin señal</span>
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

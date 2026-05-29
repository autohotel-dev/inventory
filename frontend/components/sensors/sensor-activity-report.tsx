"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SensorEvent {
  id: string;
  sensor_id: string;
  new_state: boolean;
  created_at: string;
}

interface SensorInfo {
  id: string;
  name: string;
  room_id: string;
  status: string;
  battery_level: number;
  is_open: boolean;
  last_seen: string;
}

interface RoomInfo {
  id: string;
  number: string;
}

export function SensorActivityReport() {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<SensorEvent[]>([]);
  const [sensors, setSensors] = useState<SensorInfo[]>([]);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    // Get today's start
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [eventsRes, sensorsRes, roomsRes] = await Promise.all([
      supabase
        .from("sensor_events")
        .select("*")
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("sensors").select("*"),
      supabase.from("rooms").select("id, number"),
    ]);

    if (eventsRes.data) setEvents(eventsRes.data);
    if (sensorsRes.data) setSensors(sensorsRes.data);
    if (roomsRes.data) setRooms(roomsRes.data);
    setLoading(false);
  };

  useEffect(() => {
    if (expanded && events.length === 0) {
      fetchData();
    }
  }, [expanded]);

  const report = useMemo(() => {
    if (!events.length || !sensors.length) return null;

    // Map sensor_id -> room number
    const sensorToRoom = new Map<string, string>();
    const sensorToName = new Map<string, string>();
    sensors.forEach((s) => {
      const room = rooms.find((r) => r.id === s.room_id);
      sensorToRoom.set(s.id, room?.number || "?");
      sensorToName.set(s.id, s.name);
    });

    // Count events per sensor
    const eventCounts = new Map<string, { opens: number; closes: number }>();
    events.forEach((evt) => {
      const c = eventCounts.get(evt.sensor_id) || { opens: 0, closes: 0 };
      if (evt.new_state === true || evt.new_state === ("true" as any)) {
        c.opens++;
      } else {
        c.closes++;
      }
      eventCounts.set(evt.sensor_id, c);
    });

    // Sort by activity
    const sorted = Array.from(eventCounts.entries())
      .map(([sensorId, counts]) => ({
        sensorId,
        roomNumber: sensorToRoom.get(sensorId) || "?",
        sensorName: sensorToName.get(sensorId) || "?",
        ...counts,
        total: counts.opens + counts.closes,
      }))
      .sort((a, b) => b.total - a.total);

    // Health
    const lowBattery = sensors.filter(
      (s) => s.battery_level !== undefined && s.battery_level < 20
    );
    const offline = sensors.filter((s) => {
      if (!s.last_seen) return true;
      return Date.now() - new Date(s.last_seen).getTime() > 3600000;
    });

    return {
      totalEvents: events.length,
      totalOpens: events.filter(
        (e) => e.new_state === true || e.new_state === ("true" as any)
      ).length,
      topRooms: sorted.slice(0, 5),
      lowBattery,
      offline,
    };
  }, [events, sensors, rooms]);

  return (
    <Card className="border-cyan-500/10 bg-cyan-500/5">
      <CardContent className="p-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-cyan-500/5 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">📈</span>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Reporte de Actividad del Día
              </h3>
              <p className="text-xs text-muted-foreground">
                Aperturas, cierres y salud de sensores
              </p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="px-5 pb-5 space-y-4 animate-in slide-in-from-top-2 duration-300">
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-3">
                <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Cargando reporte...
                </span>
              </div>
            ) : !report ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                Sin datos de actividad hoy
              </p>
            ) : (
              <>
                {/* Summary Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-background/50 rounded-xl p-3 border border-border/50 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Eventos Hoy
                    </p>
                    <p className="text-2xl font-black text-foreground mt-1">
                      {report.totalEvents}
                    </p>
                  </div>
                  <div className="bg-background/50 rounded-xl p-3 border border-border/50 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Aperturas
                    </p>
                    <p className="text-2xl font-black text-red-400 mt-1">
                      {report.totalOpens}
                    </p>
                  </div>
                  <div className="bg-background/50 rounded-xl p-3 border border-border/50 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Batería Baja
                    </p>
                    <p
                      className={cn(
                        "text-2xl font-black mt-1",
                        report.lowBattery.length > 0
                          ? "text-amber-400"
                          : "text-emerald-400"
                      )}
                    >
                      {report.lowBattery.length}
                    </p>
                  </div>
                  <div className="bg-background/50 rounded-xl p-3 border border-border/50 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Sin Señal
                    </p>
                    <p
                      className={cn(
                        "text-2xl font-black mt-1",
                        report.offline.length > 0
                          ? "text-red-400"
                          : "text-emerald-400"
                      )}
                    >
                      {report.offline.length}
                    </p>
                  </div>
                </div>

                {/* Top 5 Most Active */}
                {report.topRooms.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                      Top 5 — Habitaciones Más Activas
                    </h4>
                    <div className="space-y-1.5">
                      {report.topRooms.map((r, i) => {
                        const maxTotal = report.topRooms[0]?.total || 1;
                        const pct = (r.total / maxTotal) * 100;
                        return (
                          <div
                            key={r.sensorId}
                            className="flex items-center gap-3 group"
                          >
                            <span className="text-xs font-bold text-muted-foreground w-5 text-right">
                              #{i + 1}
                            </span>
                            <span className="text-sm font-bold text-foreground w-12">
                              Hab {r.roomNumber}
                            </span>
                            <div className="flex-1 h-5 bg-background/50 rounded-full border border-border/50 overflow-hidden relative">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-500/40 to-cyan-500/20 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                              <div className="absolute inset-0 flex items-center justify-end pr-2">
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  {r.opens}↑ {r.closes}↓
                                </span>
                              </div>
                            </div>
                            <span className="text-xs font-black text-foreground w-8 text-right">
                              {r.total}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Low Battery List */}
                {report.lowBattery.length > 0 && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                    <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">
                      🔋 Batería Baja
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {report.lowBattery.map((s) => {
                        const room = rooms.find((r) => r.id === s.room_id);
                        return (
                          <span
                            key={s.id}
                            className="text-xs font-bold bg-amber-500/10 text-amber-400 px-2 py-1 rounded-lg border border-amber-500/20"
                          >
                            Hab {room?.number || "?"} — {s.battery_level}%
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Offline List */}
                {report.offline.length > 0 && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                    <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">
                      ⚠️ Sensores Sin Señal (+1hr)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {report.offline.map((s) => {
                        const room = rooms.find((r) => r.id === s.room_id);
                        return (
                          <span
                            key={s.id}
                            className="text-xs font-bold bg-red-500/10 text-red-400 px-2 py-1 rounded-lg border border-red-500/20"
                          >
                            Hab {room?.number || "?"} —{" "}
                            {s.last_seen
                              ? new Date(s.last_seen).toLocaleTimeString(
                                  "es-MX",
                                  { hour: "2-digit", minute: "2-digit" }
                                )
                              : "nunca"}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

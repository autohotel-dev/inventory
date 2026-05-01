"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock, User, LogIn, LogOut, Timer,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ShiftSessionInfo {
  id: string;
  employee_name: string;
  employee_role: string;
  shift_name: string;
  clock_in_at: string;
  clock_out_at: string | null;
  status: string;
  total_actions: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  gerente: "Gerente",
  receptionist: "Recepcionista",
  valet: "Cochero",
  camarista: "Camarista",
};

export function SessionTrackerPanel() {
  const [sessions, setSessions] = useState<ShiftSessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      const supabase = createClient();

      // Traer sesiones de las últimas 48h
      const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

      const { data } = await supabase
        .from("shift_sessions")
        .select(`
          id,
          clock_in_at,
          clock_out_at,
          status,
          employees!shift_sessions_employee_id_fkey(
            first_name,
            last_name,
            role
          ),
          shift_definitions!shift_sessions_shift_definition_id_fkey(
            name
          )
        `)
        .gte("clock_in_at", cutoff)
        .order("clock_in_at", { ascending: false })
        .limit(30);

      if (!data) { setLoading(false); return; }

      // Para cada sesión, contar acciones en audit_logs
      const sessionIds = data.map((s: any) => s.id);
      const { data: actionCounts } = await supabase
        .from("audit_logs")
        .select("session_id")
        .in("session_id", sessionIds)
        .eq("event_type", "RECEPTION_ACTION");

      const countMap = new Map<string, number>();
      (actionCounts || []).forEach((a: any) => {
        if (a.session_id) {
          countMap.set(a.session_id, (countMap.get(a.session_id) || 0) + 1);
        }
      });

      const processed: ShiftSessionInfo[] = data.map((s: any) => {
        const emp = s.employees as any;
        const shift = s.shift_definitions as any;
        return {
          id: s.id,
          employee_name: emp ? `${emp.first_name} ${emp.last_name}` : "Desconocido",
          employee_role: emp?.role || "—",
          shift_name: shift?.name || "Sin turno",
          clock_in_at: s.clock_in_at,
          clock_out_at: s.clock_out_at,
          status: s.status,
          total_actions: countMap.get(s.id) || 0,
        };
      });

      setSessions(processed);
      setLoading(false);
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="border-0 shadow-xl bg-background/80 backdrop-blur-xl">
        <CardContent className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl bg-background/80 backdrop-blur-xl">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          Sesiones de Trabajo
          <Badge variant="outline" className="text-[10px] font-mono ml-1">Últimas 48h</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[550px]">
          {sessions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay sesiones recientes</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {sessions.map((session) => {
                const isActive = session.status === "active";
                const clockIn = new Date(session.clock_in_at);
                const clockOut = session.clock_out_at ? new Date(session.clock_out_at) : null;
                const durationMs = clockOut
                  ? clockOut.getTime() - clockIn.getTime()
                  : Date.now() - clockIn.getTime();
                const durationH = Math.floor(durationMs / 3600000);
                const durationM = Math.floor((durationMs % 3600000) / 60000);

                return (
                  <div key={session.id} className="px-6 py-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between">
                      {/* Info del empleado */}
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm border ${
                          isActive
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground border-border/50"
                        }`}>
                          {session.employee_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm">{session.employee_name}</h4>
                            {isActive && (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{ROLE_LABELS[session.employee_role] || session.employee_role}</span>
                            <span className="opacity-30">•</span>
                            <span>{session.shift_name}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status + Actions */}
                      <div className="text-right space-y-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold px-2 ${
                            isActive
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isActive ? "EN TURNO" : "FINALIZADO"}
                        </Badge>
                        {session.total_actions > 0 && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {session.total_actions} acciones
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <LogIn className="h-3 w-3 text-emerald-500" />
                        <span className="font-mono">{format(clockIn, "HH:mm", { locale: es })}</span>
                      </div>
                      <div className="flex-1 h-px bg-border/50 relative">
                        {isActive && (
                          <div
                            className="absolute top-0 left-0 h-full bg-emerald-500/50 rounded-full"
                            style={{ width: `${Math.min(100, (durationMs / (12 * 3600000)) * 100)}%` }}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {clockOut ? (
                          <>
                            <LogOut className="h-3 w-3 text-red-400" />
                            <span className="font-mono">{format(clockOut, "HH:mm", { locale: es })}</span>
                          </>
                        ) : (
                          <>
                            <Timer className="h-3 w-3 text-emerald-500" />
                            <span className="font-mono text-emerald-500">Ahora</span>
                          </>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono h-5 px-1.5">
                        {durationH}h {durationM}m
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

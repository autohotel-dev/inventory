"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X, Home, Clock, CreditCard, DoorOpen, ShoppingBag, UserPlus,
  ArrowRight, FileSearch, ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LogRow } from "./log-components";
import type { LogEntry, NameMap } from "@/hooks/use-log-center";

interface RoomCaseViewProps {
  roomNumber: string;
  onClose: () => void;
  nameMap: NameMap;
}

export function RoomCaseView({ roomNumber, onClose, nameMap }: RoomCaseViewProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"today" | "week" | "all">("today");

  const fetchRoomHistory = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("audit_logs")
      .select("*")
      .eq("room_number", roomNumber)
      .order("created_at", { ascending: true })
      .limit(200);

    if (timeRange === "today") {
      query = query.gte("created_at", `${new Date().toISOString().split("T")[0]}T00:00:00`);
    } else if (timeRange === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte("created_at", weekAgo.toISOString());
    }

    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  }, [roomNumber, timeRange]);

  useEffect(() => {
    fetchRoomHistory();
  }, [fetchRoomHistory]);

  // Calculate summary stats from the loaded logs
  const totalAmount = logs.reduce((sum, l) => sum + (l.amount || 0), 0);
  const actions = [...new Set(logs.map(l => l.action))];
  const employees = [...new Set(logs.filter(l => l.employee_name).map(l => l.employee_name))];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl h-full bg-background border-l border-border/20 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/10 bg-gradient-to-r from-sky-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/15 flex items-center justify-center">
              <FileSearch className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Caso Hab. {roomNumber}</h2>
              <p className="text-[11px] text-muted-foreground/60">
                {logs.length} eventos · {employees.length} empleados · ${totalAmount.toFixed(2)} en movimientos
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-lg">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Time range selector */}
        <div className="px-5 py-2 border-b border-border/5 flex items-center gap-1.5">
          {([
            { key: "today" as const, label: "Hoy" },
            { key: "week" as const, label: "7 días" },
            { key: "all" as const, label: "Todo" },
          ]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setTimeRange(opt.key)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                timeRange === opt.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground/60 hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="relative">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted" />
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-sky-400 absolute inset-0" />
              </div>
              <p className="text-xs text-muted-foreground animate-pulse">Investigando habitación {roomNumber}...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Home className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-sm">Sin actividad</p>
              <p className="text-xs mt-1 text-muted-foreground/60">No hay registros para esta habitación en el rango seleccionado</p>
            </div>
          ) : (
            <div>
              {/* Summary bar */}
              <div className="px-5 py-3 bg-muted/10 border-b border-border/5">
                <div className="flex flex-wrap gap-1.5">
                  {actions.map(action => {
                    const count = logs.filter(l => l.action === action).length;
                    return (
                      <span key={action} className="text-[9px] px-2 py-0.5 bg-muted/30 rounded-full text-muted-foreground font-medium">
                        {action.replace(/_/g, " ")} ×{count}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Timeline — chronological (oldest first) */}
              {logs.map(log => (
                <LogRow key={log.id} log={log} nameMap={nameMap} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

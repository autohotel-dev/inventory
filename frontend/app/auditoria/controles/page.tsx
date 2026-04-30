"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Tv, Search, History, Download, ArrowRight, UserCheck, Zap,
  Check, AlertTriangle, Clock, Users, Filter, ChevronDown,
  BarChart3, Timer, Award, TrendingUp
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

interface AuditLog {
  log_id: string;
  created_at: string;
  room_number: string;
  room_id: string;
  action_type: string;
  previous_status: string | null;
  new_status: string;
  action_by_name: string;
  action_by_id: string | null;
  assigned_to_name: string;
  assigned_to_id: string | null;
  notes: string | null;
}

interface AuditStat {
  employee_id: string;
  employee_name: string;
  total_assignments: number;
  total_confirmations: number;
  avg_response_minutes: number | null;
  fastest_response_minutes: number | null;
  slowest_response_minutes: number | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ASSIGNED_TO_COCHERO_FOR_TV: { label: "Asignación de TV", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: <Zap size={12} /> },
  CONFIRMED_TV_ON: { label: "TV Confirmada", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: <Check size={12} /> },
  ASSIGNED_TO_COCHERO: { label: "Asignación", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: <UserCheck size={12} /> },
  DROPPED_IN_ROOM: { label: "Dejado en Hab.", color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20", icon: <ArrowRight size={12} /> },
  VERIFIED_IN_ROOM: { label: "Verificado", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: <Check size={12} /> },
  MARKED_MISSING: { label: "Extraviado", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: <AlertTriangle size={12} /> },
  RETURNED_TO_RECEPTION: { label: "En Recepción", color: "text-purple-400 bg-purple-500/10 border-purple-500/20", icon: <History size={12} /> },
};

const formatTimestamp = (ts: string) =>
  new Date(ts).toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

const STATUS_LABELS: Record<string, string> = {
  EN_HABITACION: "En Habitación",
  PENDIENTE_ENCENDIDO: "Pendiente Encendido",
  TV_ENCENDIDA: "TV Encendida",
  EXTRAVIADO: "Extraviado",
  SIN_REGISTRO: "Sin Registro",
};

const translateStatus = (s: string | null) =>
  s ? (STATUS_LABELS[s] || s.replace(/_/g, " ")) : "—";

// ─── Page ────────────────────────────────────────────────────────────

export default function ControlesAuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStat[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters
  const [roomFilter, setRoomFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const supabase = createClient();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { p_limit: 200, p_offset: 0 };
      if (roomFilter.trim()) params.p_room_number = roomFilter.trim();
      if (employeeFilter) params.p_employee_id = employeeFilter;
      if (actionFilter) params.p_action_type = actionFilter;
      if (dateFrom) params.p_date_from = new Date(dateFrom).toISOString();
      if (dateTo) params.p_date_to = new Date(dateTo + "T23:59:59").toISOString();

      const { data, error } = await supabase.rpc("get_tv_audit_trail", params);
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Error fetching audit trail:", err);
    } finally {
      setLoading(false);
    }
  }, [roomFilter, employeeFilter, actionFilter, dateFrom, dateTo]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params: any = {};
      if (dateFrom) params.p_date_from = new Date(dateFrom).toISOString();
      if (dateTo) params.p_date_to = new Date(dateTo + "T23:59:59").toISOString();

      const { data, error } = await supabase.rpc("get_tv_audit_stats", params);
      if (error) throw error;
      setStats(data || []);
    } catch (err) {
      console.error("Error fetching audit stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [dateFrom, dateTo]);

  const fetchEmployees = useCallback(async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .ilike("role", "%cochero%")
      .order("first_name");
    setEmployees(data || []);
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [fetchLogs, fetchStats]);

  const exportCSV = () => {
    const headers = [
      "Fecha/Hora", "Habitación", "Acción", "Estado Anterior", "Nuevo Estado",
      "Ejecutado Por", "Cochero Asignado", "Notas"
    ];
    const rows = logs.map(l => [
      formatTimestamp(l.created_at), l.room_number, l.action_type,
      l.previous_status || "", l.new_status, l.action_by_name,
      l.assigned_to_name, l.notes || ""
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_controles_tv_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalAssignments = logs.filter(l => l.action_type === "ASSIGNED_TO_COCHERO_FOR_TV").length;
  const totalConfirmations = logs.filter(l => l.action_type === "CONFIRMED_TV_ON").length;
  const totalMissing = logs.filter(l => l.action_type === "MARKED_MISSING").length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30">
              <Tv className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Auditoría de Controles de TV</h1>
              <p className="text-sm text-muted-foreground">
                Trazabilidad forense de asignaciones, confirmaciones y responsables
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-1" />
            Filtros
            <ChevronDown className={cn("h-3 w-3 ml-1 transition-transform", showFilters && "rotate-180")} />
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={logs.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="bg-zinc-950 border-white/10">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 block">Habitación</label>
                <Input
                  placeholder="Ej: 12"
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                  className="h-9 bg-zinc-900 border-white/10"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 block">Cochero</label>
                <select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-zinc-900 border border-white/10 text-sm text-white"
                >
                  <option value="">Todos</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 block">Acción</label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-zinc-900 border border-white/10 text-sm text-white"
                >
                  <option value="">Todas</option>
                  <option value="ASSIGNED_TO_COCHERO_FOR_TV">Asignación</option>
                  <option value="CONFIRMED_TV_ON">Confirmación</option>
                  <option value="MARKED_MISSING">Extraviado</option>
                  <option value="VERIFIED_IN_ROOM">Verificado</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 block">Desde</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 bg-zinc-900 border-white/10"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 block">Hasta</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 bg-zinc-900 border-white/10"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-zinc-950 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
              <Zap className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-black">{totalAssignments}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Asignaciones</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
              <Check className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-black">{totalConfirmations}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Confirmaciones</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-black">{totalMissing}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Extraviados</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-black">{logs.length}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Total Registros</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats per cochero */}
      {stats.length > 0 && (
        <Card className="bg-zinc-950 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              Rendimiento por Cochero
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Cochero</th>
                    <th className="text-center py-2 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Asignaciones</th>
                    <th className="text-center py-2 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Confirmados</th>
                    <th className="text-center py-2 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      <div className="flex items-center justify-center gap-1"><Timer size={10} /> Promedio</div>
                    </th>
                    <th className="text-center py-2 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Más Rápido</th>
                    <th className="text-center py-2 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Más Lento</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(s => (
                    <tr key={s.employee_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 bg-zinc-800 rounded-full flex items-center justify-center">
                            <Users size={12} className="text-zinc-400" />
                          </div>
                          <span className="font-bold text-white">{s.employee_name}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-3 font-mono font-bold">{s.total_assignments}</td>
                      <td className="text-center py-3 px-3">
                        <span className={cn(
                          "font-mono font-bold",
                          s.total_confirmations === s.total_assignments ? "text-emerald-400" : "text-amber-400"
                        )}>
                          {s.total_confirmations}
                        </span>
                      </td>
                      <td className="text-center py-3 px-3">
                        {s.avg_response_minutes != null ? (
                          <Badge variant="outline" className={cn(
                            "font-mono text-xs",
                            s.avg_response_minutes <= 5 ? "text-emerald-400 border-emerald-500/20" :
                            s.avg_response_minutes <= 15 ? "text-amber-400 border-amber-500/20" :
                            "text-red-400 border-red-500/20"
                          )}>
                            {s.avg_response_minutes} min
                          </Badge>
                        ) : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="text-center py-3 px-3 text-xs font-mono text-emerald-400">
                        {s.fastest_response_minutes != null ? `${s.fastest_response_minutes} min` : "—"}
                      </td>
                      <td className="text-center py-3 px-3 text-xs font-mono text-red-400">
                        {s.slowest_response_minutes != null ? `${s.slowest_response_minutes} min` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Audit Log Table */}
      <Card className="bg-zinc-950 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Registro de Auditoría Detallado
            <span className="text-zinc-600 font-mono text-xs ml-2">({logs.length} registros)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-bold">Sin registros de auditoría</p>
              <p className="text-sm">Ajusta los filtros o espera a que se generen acciones.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Fecha/Hora</th>
                    <th className="text-center py-2 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Hab.</th>
                    <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Acción</th>
                    <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Transición</th>
                    <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Ejecutado Por</th>
                    <th className="text-left py-2 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Cochero</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const meta = ACTION_LABELS[log.action_type] || {
                      label: log.action_type.replace(/_/g, " "),
                      color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
                      icon: <History size={12} />,
                    };
                    return (
                      <tr key={log.log_id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                        <td className="py-3 px-3">
                          <div className="text-xs font-mono text-zinc-400 whitespace-nowrap">
                            {formatTimestamp(log.created_at)}
                          </div>
                        </td>
                        <td className="text-center py-3 px-3">
                          <span className="text-lg font-black text-white">{log.room_number}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-wider",
                            meta.color
                          )}>
                            {meta.icon}
                            {meta.label}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                            <span>{translateStatus(log.previous_status)}</span>
                            <ArrowRight size={10} className="text-zinc-700" />
                            <span className="font-bold text-zinc-300">{translateStatus(log.new_status)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-xs font-bold text-zinc-300">{log.action_by_name}</span>
                        </td>
                        <td className="py-3 px-3">
                          {log.assigned_to_name !== "—" ? (
                            <div className="flex items-center gap-1">
                              <UserCheck size={12} className="text-amber-400" />
                              <span className="text-xs font-bold text-amber-300">{log.assigned_to_name}</span>
                            </div>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

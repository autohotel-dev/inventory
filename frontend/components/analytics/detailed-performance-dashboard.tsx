"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { InefficiencyAlerts } from "./inefficiency-alerts";
import { PerformanceScoreBar } from "./performance/performance-score-bar";
import { EmployeeDetailModal } from "./performance/employee-detail-modal";
import { DepartmentComparison } from "./performance/department-comparison";
import { CocheroActionBreakdown } from "./performance/cochero-action-breakdown";
import { ReceptionistActionBreakdown, ReceptionistActionMetrics } from "./performance/receptionist-action-breakdown";
import {
  CocheroKPIv2,
  ReceptionistKPIv2,
  CamaristaKPIv2,
  EmployeeRanking,
  CocheroActionMetrics,
  getScoreColor,
  getTrendIcon,
  SLA_TARGETS,
} from "./performance/types";
import {
  Car,
  MonitorCheck,
  Sparkles,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Briefcase,
  Target,
  BarChart3,
  Trophy,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Download,
  Shield,
} from "lucide-react";
import { format, subDays } from "date-fns";

// Sorting types
type SortField = string;
type SortDirection = "asc" | "desc";

function SortableHeader({
  label,
  field,
  currentField,
  currentDirection,
  onSort,
  className = "",
}: {
  label: string;
  field: string;
  currentField: string;
  currentDirection: SortDirection;
  onSort: (field: string) => void;
  className?: string;
}) {
  const isActive = currentField === field;
  return (
    <th
      className={`px-3 md:px-5 py-3 md:py-4 font-bold cursor-pointer hover:bg-muted/50 transition-colors select-none ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {isActive ? (
          currentDirection === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </th>
  );
}

function TrendArrow({ pct }: { pct: number }) {
  const { icon, color } = getTrendIcon(pct);
  const Icon = icon === "up" ? TrendingUp : icon === "down" ? TrendingDown : Minus;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function useSorting<T>(
  data: T[],
  defaultField: string,
  defaultDirection: SortDirection = "desc"
) {
  const [sortField, setSortField] = useState<string>(defaultField);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField]
  );

  const sorted = useMemo(() => {
    return [...data].sort((a: any, b: any) => {
      const aVal = Number(a[sortField]) || 0;
      const bVal = Number(b[sortField]) || 0;
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortField, sortDirection]);

  return { sorted, sortField, sortDirection, handleSort };
}

function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => `"${row[h] ?? ""}"`).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
  link.click();
}

// Re-export Activity icon to avoid import issues
function Activity(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export function DetailedPerformanceDashboard() {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });

  const [cocheros, setCocheros] = useState<CocheroKPIv2[]>([]);
  const [receptionists, setReceptionists] = useState<ReceptionistKPIv2[]>([]);
  const [camaristas, setCamaristas] = useState<CamaristaKPIv2[]>([]);
  const [rankings, setRankings] = useState<EmployeeRanking[]>([]);
  const [cocheroActions, setCocheroActions] = useState<CocheroActionMetrics[]>([]);
  const [receptionistActions, setReceptionistActions] = useState<ReceptionistActionMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [selectedEmployee, setSelectedEmployee] = useState<{
    data: any;
    department: "cocheros" | "recepcion" | "camaristas";
  } | null>(null);

  // Fallback flags for when v2 RPCs don't exist yet
  const [useV2, setUseV2] = useState(true);

  const filteredCocheros = useMemo(
    () =>
      cocheros.filter((c) =>
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? c.is_active !== false
          : c.is_active === false
      ),
    [cocheros, statusFilter]
  );
  const filteredReceptionists = useMemo(
    () =>
      receptionists.filter((r) =>
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? r.is_active !== false
          : r.is_active === false
      ),
    [receptionists, statusFilter]
  );
  const filteredCamaristas = useMemo(
    () =>
      camaristas.filter((c) =>
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? c.is_active !== false
          : c.is_active === false
      ),
    [camaristas, statusFilter]
  );

  const cocheroSorting = useSorting(filteredCocheros, "performance_score");
  const receptionistSorting = useSorting(filteredReceptionists, "performance_score");
  const camaristaSorting = useSorting(filteredCamaristas, "performance_score");

  // Team averages for modal comparison
  const cocheroTeamAvg = useMemo(() => {
    const active = filteredCocheros.filter((c) => Number(c.total_checkins) > 0);
    return {
      avgTime:
        active.length > 0
          ? active.reduce((s, c) => s + Number(c.avg_checkin_time_minutes || 0), 0) / active.length
          : 0,
      avgScore:
        active.length > 0
          ? active.reduce((s, c) => s + Number(c.performance_score || 0), 0) / active.length
          : 0,
      avgVolume:
        active.length > 0
          ? active.reduce((s, c) => s + Number(c.total_checkins || 0) + Number(c.total_checkouts || 0), 0) / active.length
          : 0,
    };
  }, [filteredCocheros]);

  const receptionistTeamAvg = useMemo(() => {
    const active = filteredReceptionists.filter(
      (r) => Number(r.total_entries_processed) > 0
    );
    return {
      avgTime:
        active.length > 0
          ? active.reduce((s, r) => s + Number(r.avg_checkin_processing_minutes || 0), 0) /
            active.length
          : 0,
      avgScore:
        active.length > 0
          ? active.reduce((s, r) => s + Number(r.performance_score || 0), 0) / active.length
          : 0,
      avgVolume:
        active.length > 0
          ? active.reduce(
              (s, r) => s + Number(r.total_entries_processed || 0) + Number(r.total_exits_processed || 0),
              0
            ) / active.length
          : 0,
    };
  }, [filteredReceptionists]);

  const camaristaTeamAvg = useMemo(() => {
    const active = filteredCamaristas.filter((c) => Number(c.total_rooms_cleaned) > 0);
    return {
      avgTime:
        active.length > 0
          ? active.reduce((s, c) => s + Number(c.avg_cleaning_time_minutes || 0), 0) / active.length
          : 0,
      avgScore:
        active.length > 0
          ? active.reduce((s, c) => s + Number(c.performance_score || 0), 0) / active.length
          : 0,
      avgVolume:
        active.length > 0
          ? active.reduce((s, c) => s + Number(c.total_rooms_cleaned || 0), 0) / active.length
          : 0,
    };
  }, [filteredCamaristas]);

  useEffect(() => {
    const fetchKPIs = async () => {
      setLoading(true);
      const supabase = createClient();

      try {
        if (useV2) {
          // Try v2 RPCs first
          const [cocherosRes, receptionistsRes, camaristasRes, rankingsRes] =
            await Promise.all([
              supabase.rpc("get_cochero_performance_v2", {
                p_start_date: dateRange.start,
                p_end_date: dateRange.end,
              }),
              supabase.rpc("get_receptionist_performance_v2", {
                p_start_date: dateRange.start,
                p_end_date: dateRange.end,
              }),
              supabase.rpc("get_camarista_performance_v2", {
                p_start_date: dateRange.start,
                p_end_date: dateRange.end,
              }),
              supabase.rpc("get_employee_ranking", {
                p_start_date: dateRange.start,
                p_end_date: dateRange.end,
              }),
            ]);

          // If any v2 RPC fails (doesn't exist yet), fallback to v1
          if (cocherosRes.error || receptionistsRes.error || camaristasRes.error) {
            console.warn("V2 RPCs not available, falling back to v1:", cocherosRes.error?.message);
            setUseV2(false);
            // Fallback to v1
            const [c1, r1, cam1] = await Promise.all([
              supabase.rpc("get_cochero_performance_kpis", {
                p_start_date: dateRange.start,
                p_end_date: dateRange.end,
              }),
              supabase.rpc("get_receptionist_performance_kpis", {
                p_start_date: dateRange.start,
                p_end_date: dateRange.end,
              }),
              supabase.rpc("get_camarista_performance_kpis", {
                p_start_date: dateRange.start,
                p_end_date: dateRange.end,
              }),
            ]);
            if (c1.data) setCocheros(c1.data as any);
            if (r1.data) setReceptionists(r1.data as any);
            if (cam1.data) setCamaristas(cam1.data as any);
            setRankings([]);
          } else {
            if (cocherosRes.data) setCocheros(cocherosRes.data);
            if (receptionistsRes.data) setReceptionists(receptionistsRes.data);
            if (camaristasRes.data) setCamaristas(camaristasRes.data);
            if (rankingsRes.data) setRankings(rankingsRes.data);

            // Fetch action metrics (separate call, graceful fallback)
            try {
              const actionsRes = await supabase.rpc("get_cochero_action_metrics", {
                p_start_date: dateRange.start,
                p_end_date: dateRange.end,
              });
              if (actionsRes.data) setCocheroActions(actionsRes.data);
            } catch {
              console.warn("get_cochero_action_metrics not available yet");
            }

            // Fetch receptionist action metrics (separate call, graceful fallback)
            try {
              const recActionsRes = await supabase.rpc("get_receptionist_action_metrics", {
                p_start_date: dateRange.start,
                p_end_date: dateRange.end,
              });
              if (recActionsRes.data) setReceptionistActions(recActionsRes.data);
            } catch {
              console.warn("get_receptionist_action_metrics not available yet");
            }
          }
        } else {
          // Direct v1 fallback
          const [c1, r1, cam1] = await Promise.all([
            supabase.rpc("get_cochero_performance_kpis", {
              p_start_date: dateRange.start,
              p_end_date: dateRange.end,
            }),
            supabase.rpc("get_receptionist_performance_kpis", {
              p_start_date: dateRange.start,
              p_end_date: dateRange.end,
            }),
            supabase.rpc("get_camarista_performance_kpis", {
              p_start_date: dateRange.start,
              p_end_date: dateRange.end,
            }),
          ]);
          if (c1.data) setCocheros(c1.data as any);
          if (r1.data) setReceptionists(r1.data as any);
          if (cam1.data) setCamaristas(cam1.data as any);
          setRankings([]);
        }
      } catch (error) {
        console.error("Error fetching detailed KPIs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchKPIs();
  }, [dateRange.start, dateRange.end, useV2]);

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500">
      {/* Header section */}
      <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between bg-gradient-to-r from-background to-muted p-4 md:p-6 rounded-xl md:rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <Activity className="h-5 w-5 md:h-8 md:w-8 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Tiempos y Rendimiento
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm font-medium hidden sm:block">
              Análisis granular de eficiencia por departamento — Scores, SLA, Tendencias
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-background border rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary h-9"
          >
            <option value="active">Personal Activo</option>
            <option value="inactive">Personal Inactivo</option>
            <option value="all">Todos</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="px-2 py-2 bg-background border rounded-lg text-xs md:text-sm font-medium focus:ring-2 focus:ring-primary h-9 flex-1 min-w-0"
            />
            <span className="text-muted-foreground text-xs">a</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="px-2 py-2 bg-background border rounded-lg text-xs md:text-sm font-medium focus:ring-2 focus:ring-primary h-9 flex-1 min-w-0"
            />
          </div>
        </div>
      </div>

      {/* Alertas Críticas */}
      <InefficiencyAlerts />

      <Tabs defaultValue="cocheros" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4 md:mb-8 h-10 md:h-14 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger
            value="cocheros"
            className="rounded-lg text-xs md:text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1 md:gap-2 px-1 md:px-3"
          >
            <Car className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Cocheros</span>
            <span className="sm:hidden">Valet</span>
          </TabsTrigger>
          <TabsTrigger
            value="recepcion"
            className="rounded-lg text-xs md:text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1 md:gap-2 px-1 md:px-3"
          >
            <MonitorCheck className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Recepción</span>
            <span className="sm:hidden">Recep.</span>
          </TabsTrigger>
          <TabsTrigger
            value="camaristas"
            className="rounded-lg text-xs md:text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1 md:gap-2 px-1 md:px-3"
          >
            <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Camaristas</span>
            <span className="sm:hidden">Limp.</span>
          </TabsTrigger>
          <TabsTrigger
            value="ranking"
            className="rounded-lg text-xs md:text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1 md:gap-2 px-1 md:px-3"
          >
            <Trophy className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Ranking</span>
            <span className="sm:hidden">Rank</span>
          </TabsTrigger>
        </TabsList>

        {/* ======================= COCHEROS ======================= */}
        <TabsContent value="cocheros" className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
            <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-5">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-600 w-fit mb-2">
                  <Clock className="h-4 w-4" />
                </div>
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">Entrada Prom.</h4>
                <div className="text-lg md:text-2xl font-bold">
                  {filteredCocheros.length > 0
                    ? (
                        filteredCocheros.reduce(
                          (a, b) => a + Number(b.avg_checkin_time_minutes || 0),
                          0
                        ) / filteredCocheros.length
                      ).toFixed(1)
                    : "0"}
                  <span className="text-xs md:text-sm text-muted-foreground"> min</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-indigo-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-5">
                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-600 w-fit mb-2">
                  <Clock className="h-4 w-4" />
                </div>
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">Salida Prom.</h4>
                <div className="text-lg md:text-2xl font-bold">
                  {filteredCocheros.length > 0
                    ? (
                        filteredCocheros.reduce(
                          (a, b) => a + Number(b.avg_checkout_time_minutes || 0),
                          0
                        ) / filteredCocheros.length
                      ).toFixed(1)
                    : "0"}
                  <span className="text-xs md:text-sm text-muted-foreground"> min</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-5">
                <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-600 w-fit mb-2">
                  <Briefcase className="h-4 w-4" />
                </div>
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">Servicios</h4>
                <div className="text-lg md:text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {filteredCocheros.reduce((a, b) => a + Number(b.total_services || 0), 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-5">
                <div className="p-2 bg-amber-500/20 rounded-lg text-amber-600 w-fit mb-2">
                  <Target className="h-4 w-4" />
                </div>
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">SLA Prom.</h4>
                <div className="text-lg md:text-2xl font-bold">
                  {filteredCocheros.length > 0
                    ? (
                        filteredCocheros.reduce(
                          (a, b) => a + Number(b.sla_compliance_pct || 0),
                          0
                        ) / filteredCocheros.length
                      ).toFixed(0)
                    : "0"}
                  <span className="text-xs md:text-sm text-muted-foreground">%</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-0 shadow-sm hidden md:block">
              <CardContent className="p-3 md:p-5">
                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-600 w-fit mb-2">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">Score Prom.</h4>
                <div className="text-lg md:text-2xl font-bold">
                  {cocheroTeamAvg.avgScore.toFixed(0)}
                  <span className="text-xs md:text-sm text-muted-foreground">/100</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table with sortable columns */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 md:px-6 py-2 bg-muted/20 border-b">
              <span className="text-xs text-muted-foreground">
                {filteredCocheros.length} cochero(s) • Click en columna para ordenar • Click en fila para detalle
              </span>
              <button
                onClick={() => exportToCSV(filteredCocheros, "cocheros_performance")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
              >
                <Download className="h-3 w-3" />
                CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm text-left">
                <thead className="text-[10px] md:text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 md:px-5 py-3 md:py-4 font-bold">Cochero</th>
                    <SortableHeader label="Recibidos" field="total_checkins" currentField={cocheroSorting.sortField} currentDirection={cocheroSorting.sortDirection} onSort={cocheroSorting.handleSort} />
                    <SortableHeader label="Entrada" field="avg_checkin_time_minutes" currentField={cocheroSorting.sortField} currentDirection={cocheroSorting.sortDirection} onSort={cocheroSorting.handleSort} />
                    <SortableHeader label="Entregados" field="total_checkouts" currentField={cocheroSorting.sortField} currentDirection={cocheroSorting.sortDirection} onSort={cocheroSorting.handleSort} className="hidden md:table-cell" />
                    <SortableHeader label="Salida" field="avg_checkout_time_minutes" currentField={cocheroSorting.sortField} currentDirection={cocheroSorting.sortDirection} onSort={cocheroSorting.handleSort} />
                    <SortableHeader label="SLA" field="sla_compliance_pct" currentField={cocheroSorting.sortField} currentDirection={cocheroSorting.sortDirection} onSort={cocheroSorting.handleSort} className="hidden md:table-cell" />
                    <SortableHeader label="Score" field="performance_score" currentField={cocheroSorting.sortField} currentDirection={cocheroSorting.sortDirection} onSort={cocheroSorting.handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Cargando datos granulares...
                        </div>
                      </td>
                    </tr>
                  ) : cocheroSorting.sorted.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        No hay datos en este periodo
                      </td>
                    </tr>
                  ) : (
                    cocheroSorting.sorted.map((c) => (
                      <tr
                        key={c.employee_id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedEmployee({ data: c, department: "cocheros" })}
                      >
                        <td className="px-3 md:px-5 py-3 md:py-4 font-semibold">{c.employee_name}</td>
                        <td className="px-3 md:px-5 py-3 md:py-4 tabular-nums">{c.total_checkins}</td>
                        <td className="px-3 md:px-5 py-3 md:py-4">
                          <span
                            className={`font-semibold tabular-nums ${
                              Number(c.avg_checkin_time_minutes) > SLA_TARGETS.cochero.checkin
                                ? "text-red-500"
                                : "text-green-500"
                            }`}
                          >
                            {Number(c.avg_checkin_time_minutes || 0).toFixed(1)} min
                          </span>
                        </td>
                        <td className="px-3 md:px-5 py-3 md:py-4 hidden md:table-cell tabular-nums">
                          {c.total_checkouts}
                        </td>
                        <td className="px-3 md:px-5 py-3 md:py-4">
                          <span
                            className={`font-semibold tabular-nums ${
                              Number(c.avg_checkout_time_minutes) > SLA_TARGETS.cochero.checkout
                                ? "text-red-500"
                                : "text-green-500"
                            }`}
                          >
                            {Number(c.avg_checkout_time_minutes || 0).toFixed(1)} min
                          </span>
                        </td>
                        <td className="px-3 md:px-5 py-3 md:py-4 hidden md:table-cell">
                          <span className={`font-semibold ${getScoreColor(Number(c.sla_compliance_pct || 0))}`}>
                            {Number(c.sla_compliance_pct || 0).toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-3 md:px-5 py-3 md:py-4 min-w-[120px]">
                          <PerformanceScoreBar
                            score={Number(c.performance_score || 0)}
                            size="sm"
                            showLabel={false}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Action-level breakdown */}
          <CocheroActionBreakdown data={cocheroActions} loading={loading} />
        </TabsContent>

        {/* ======================= RECEPCION ======================= */}
        <TabsContent value="recepcion" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
            <Card className="bg-gradient-to-br from-indigo-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-5">
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">Entradas</h4>
                <div className="text-lg md:text-2xl font-bold">
                  {filteredReceptionists.reduce((a, b) => a + Number(b.total_entries_processed || 0), 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-5">
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">Salidas</h4>
                <div className="text-lg md:text-2xl font-bold">
                  {filteredReceptionists.reduce((a, b) => a + Number(b.total_exits_processed || 0), 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-5">
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">T. Entrada Prom.</h4>
                <div className="text-lg md:text-2xl font-bold">
                  {filteredReceptionists.length > 0
                    ? (
                        filteredReceptionists.reduce(
                          (a, b) => a + Number((b as any).avg_checkin_processing_minutes || 0),
                          0
                        ) / filteredReceptionists.length
                      ).toFixed(1)
                    : "0"}
                  <span className="text-xs md:text-sm text-muted-foreground"> min</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-5">
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">SLA Prom.</h4>
                <div className="text-lg md:text-2xl font-bold">
                  {filteredReceptionists.length > 0
                    ? (
                        filteredReceptionists.reduce(
                          (a, b) => a + Number(b.sla_compliance_pct || 0),
                          0
                        ) / filteredReceptionists.length
                      ).toFixed(0)
                    : "0"}
                  <span className="text-xs md:text-sm text-muted-foreground">%</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-0 shadow-sm hidden md:block">
              <CardContent className="p-3 md:p-5">
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">Ingresos</h4>
                <div className="text-lg md:text-2xl font-bold text-emerald-600">
                  ${filteredReceptionists
                    .reduce((a, b) => a + Number(b.total_revenue || 0), 0)
                    .toLocaleString("es-MX", { minimumFractionDigits: 0 })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 md:px-6 py-2 bg-muted/20 border-b">
              <span className="text-xs text-muted-foreground">
                {filteredReceptionists.length} recepcionista(s) • Click en columna para ordenar
              </span>
              <button
                onClick={() => exportToCSV(filteredReceptionists, "recepcionistas_performance")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
              >
                <Download className="h-3 w-3" />
                CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm text-left">
                <thead className="text-[10px] md:text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 md:px-5 py-3 md:py-4 font-bold">Nombre</th>
                    <SortableHeader label="Entradas" field="total_entries_processed" currentField={receptionistSorting.sortField} currentDirection={receptionistSorting.sortDirection} onSort={receptionistSorting.handleSort} />
                    <SortableHeader label="T.Entrada" field="avg_checkin_processing_minutes" currentField={receptionistSorting.sortField} currentDirection={receptionistSorting.sortDirection} onSort={receptionistSorting.handleSort} />
                    <SortableHeader label="Salidas" field="total_exits_processed" currentField={receptionistSorting.sortField} currentDirection={receptionistSorting.sortDirection} onSort={receptionistSorting.handleSort} className="hidden md:table-cell" />
                    <SortableHeader label="T.Salida" field="avg_checkout_processing_minutes" currentField={receptionistSorting.sortField} currentDirection={receptionistSorting.sortDirection} onSort={receptionistSorting.handleSort} className="hidden md:table-cell" />
                    <SortableHeader label="Ingresos" field="total_revenue" currentField={receptionistSorting.sortField} currentDirection={receptionistSorting.sortDirection} onSort={receptionistSorting.handleSort} />
                    <SortableHeader label="SLA" field="sla_compliance_pct" currentField={receptionistSorting.sortField} currentDirection={receptionistSorting.sortDirection} onSort={receptionistSorting.handleSort} className="hidden md:table-cell" />
                    <SortableHeader label="Score" field="performance_score" currentField={receptionistSorting.sortField} currentDirection={receptionistSorting.sortDirection} onSort={receptionistSorting.handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Cargando datos granulares...
                        </div>
                      </td>
                    </tr>
                  ) : receptionistSorting.sorted.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                        No hay datos en este periodo
                      </td>
                    </tr>
                  ) : (
                    receptionistSorting.sorted.map((r) => (
                      <tr
                        key={r.employee_id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedEmployee({ data: r, department: "recepcion" })}
                      >
                        <td className="px-3 md:px-5 py-3 md:py-4 font-semibold">{r.employee_name}</td>
                        <td className="px-3 md:px-5 py-3 md:py-4 tabular-nums">{r.total_entries_processed}</td>
                        <td className="px-3 md:px-5 py-3 md:py-4">
                          <span
                            className={`font-semibold tabular-nums ${
                              Number((r as any).avg_checkin_processing_minutes || 0) > SLA_TARGETS.receptionist.checkin
                                ? "text-red-500"
                                : "text-green-500"
                            }`}
                          >
                            {Number((r as any).avg_checkin_processing_minutes || 0).toFixed(1)} min
                          </span>
                        </td>
                        <td className="px-3 md:px-5 py-3 md:py-4 hidden md:table-cell tabular-nums">
                          {r.total_exits_processed}
                        </td>
                        <td className="px-3 md:px-5 py-3 md:py-4 hidden md:table-cell">
                          <span
                            className={`font-semibold tabular-nums ${
                              Number((r as any).avg_checkout_processing_minutes || 0) > SLA_TARGETS.receptionist.checkout
                                ? "text-red-500"
                                : "text-green-500"
                            }`}
                          >
                            {Number((r as any).avg_checkout_processing_minutes || 0).toFixed(1)} min
                          </span>
                        </td>
                        <td className="px-3 md:px-5 py-3 md:py-4 font-medium text-green-600 dark:text-green-400 tabular-nums">
                          ${Number(r.total_revenue || 0).toLocaleString("es-MX", { minimumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 md:px-5 py-3 md:py-4 hidden md:table-cell">
                          <span className={`font-semibold ${getScoreColor(Number(r.sla_compliance_pct || 0))}`}>
                            {Number(r.sla_compliance_pct || 0).toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-3 md:px-5 py-3 md:py-4 min-w-[120px]">
                          <PerformanceScoreBar
                            score={Number(r.performance_score || 0)}
                            size="sm"
                            showLabel={false}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Action-level breakdown */}
          <ReceptionistActionBreakdown data={receptionistActions} loading={loading} />
        </TabsContent>

        {/* ======================= CAMARISTAS ======================= */}
        <TabsContent value="camaristas" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
            <Card className="bg-gradient-to-br from-cyan-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-5">
                <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-600 w-fit mb-2">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">Limpiadas</h4>
                <div className="text-lg md:text-2xl font-bold">
                  {filteredCamaristas.reduce((a, b) => a + Number(b.total_rooms_cleaned || 0), 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-5">
                <div className="p-2 bg-amber-500/20 rounded-lg text-amber-600 w-fit mb-2">
                  <Clock className="h-4 w-4" />
                </div>
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">Prom. Limpieza</h4>
                <div className="text-lg md:text-2xl font-bold">
                  {filteredCamaristas.length > 0
                    ? (
                        filteredCamaristas.reduce(
                          (a, b) => a + Number(b.avg_cleaning_time_minutes || 0),
                          0
                        ) / filteredCamaristas.length
                      ).toFixed(1)
                    : "0"}
                  <span className="text-xs md:text-sm text-muted-foreground"> min</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-5">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-600 w-fit mb-2">
                  <Activity className="h-4 w-4" />
                </div>
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">En Limpieza</h4>
                <div className="text-lg md:text-2xl font-bold text-blue-600">
                  {filteredCamaristas.reduce((a, b) => a + Number(b.currently_cleaning || 0), 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-rose-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-5">
                <div className="p-2 bg-rose-500/20 rounded-lg text-rose-600 w-fit mb-2">
                  <Target className="h-4 w-4" />
                </div>
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">SLA Prom.</h4>
                <div className="text-lg md:text-2xl font-bold">
                  {filteredCamaristas.length > 0
                    ? (
                        filteredCamaristas.reduce(
                          (a, b) => a + Number(b.sla_compliance_pct || 0),
                          0
                        ) / filteredCamaristas.length
                      ).toFixed(0)
                    : "0"}
                  <span className="text-xs md:text-sm text-muted-foreground">%</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-0 shadow-sm hidden md:block">
              <CardContent className="p-3 md:p-5">
                <div className="p-2 bg-red-500/20 rounded-lg text-red-600 w-fit mb-2">
                  <Shield className="h-4 w-4" />
                </div>
                <h4 className="text-[10px] md:text-xs font-medium text-muted-foreground mb-1">Re-limpiezas</h4>
                <div className="text-lg md:text-2xl font-bold text-red-600">
                  {filteredCamaristas.reduce((a, b) => a + Number((b as any).recleanings_count || 0), 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 md:px-6 py-2 bg-muted/20 border-b">
              <span className="text-xs text-muted-foreground">
                {filteredCamaristas.length} camarista(s) • Click en columna para ordenar
              </span>
              <button
                onClick={() => exportToCSV(filteredCamaristas, "camaristas_performance")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
              >
                <Download className="h-3 w-3" />
                CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm text-left">
                <thead className="text-[10px] md:text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 md:px-5 py-3 md:py-4 font-bold">Nombre</th>
                    <SortableHeader label="Limpiadas" field="total_rooms_cleaned" currentField={camaristaSorting.sortField} currentDirection={camaristaSorting.sortDirection} onSort={camaristaSorting.handleSort} />
                    <SortableHeader label="Tiempo" field="avg_cleaning_time_minutes" currentField={camaristaSorting.sortField} currentDirection={camaristaSorting.sortDirection} onSort={camaristaSorting.handleSort} />
                    <SortableHeader label="SLA" field="sla_compliance_pct" currentField={camaristaSorting.sortField} currentDirection={camaristaSorting.sortDirection} onSort={camaristaSorting.handleSort} className="hidden md:table-cell" />
                    <SortableHeader label="Re-limp." field="recleanings_count" currentField={camaristaSorting.sortField} currentDirection={camaristaSorting.sortDirection} onSort={camaristaSorting.handleSort} className="hidden md:table-cell" />
                    <SortableHeader label="Score" field="performance_score" currentField={camaristaSorting.sortField} currentDirection={camaristaSorting.sortDirection} onSort={camaristaSorting.handleSort} />
                    <th className="px-3 md:px-5 py-3 md:py-4 font-bold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Cargando datos granulares...
                        </div>
                      </td>
                    </tr>
                  ) : camaristaSorting.sorted.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        No hay datos en este periodo
                      </td>
                    </tr>
                  ) : (
                    camaristaSorting.sorted.map((c) => {
                      const avgTime = Number(c.avg_cleaning_time_minutes) || 0;
                      return (
                        <tr
                          key={c.employee_id}
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setSelectedEmployee({ data: c, department: "camaristas" })}
                        >
                          <td className="px-3 md:px-5 py-3 md:py-4 font-semibold">{c.employee_name}</td>
                          <td className="px-3 md:px-5 py-3 md:py-4 tabular-nums">{c.total_rooms_cleaned}</td>
                          <td className="px-3 md:px-5 py-3 md:py-4">
                            <span
                              className={`font-semibold tabular-nums ${
                                avgTime > SLA_TARGETS.camarista.cleaning
                                  ? "text-red-500"
                                  : avgTime > 20
                                  ? "text-amber-500"
                                  : "text-green-500"
                              }`}
                            >
                              {avgTime.toFixed(1)} min
                            </span>
                          </td>
                          <td className="px-3 md:px-5 py-3 md:py-4 hidden md:table-cell">
                            <span className={`font-semibold ${getScoreColor(Number(c.sla_compliance_pct || 0))}`}>
                              {Number(c.sla_compliance_pct || 0).toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-3 md:px-5 py-3 md:py-4 hidden md:table-cell">
                            {Number((c as any).recleanings_count || 0) > 0 ? (
                              <Badge variant="destructive" className="text-[10px]">
                                {(c as any).recleanings_count}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">0</span>
                            )}
                          </td>
                          <td className="px-3 md:px-5 py-3 md:py-4 min-w-[120px]">
                            <PerformanceScoreBar
                              score={Number(c.performance_score || 0)}
                              size="sm"
                              showLabel={false}
                            />
                          </td>
                          <td className="px-3 md:px-5 py-3 md:py-4">
                            {Number(c.currently_cleaning) > 0 ? (
                              <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-medium text-xs">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                                </span>
                                <span className="hidden md:inline">Limpiando</span> {c.currently_cleaning}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">Libre</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ======================= RANKING ======================= */}
        <TabsContent value="ranking" className="space-y-6">
          <DepartmentComparison rankings={rankings} loading={loading} />
        </TabsContent>
      </Tabs>

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee.data}
          department={selectedEmployee.department}
          teamAvg={
            selectedEmployee.department === "cocheros"
              ? cocheroTeamAvg
              : selectedEmployee.department === "recepcion"
              ? receptionistTeamAvg
              : camaristaTeamAvg
          }
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}

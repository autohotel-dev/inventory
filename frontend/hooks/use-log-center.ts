"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────

export interface LogEntry {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  action: string;
  severity: string;
  employee_name?: string;
  employee_id?: string;
  user_role?: string;
  description?: string;
  room_number?: string;
  payment_method?: string;
  amount?: number;
  session_id?: string;
  created_at: string;
  metadata?: Record<string, any>;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  changed_fields?: string[];
}

export type LogCategory = "all" | "reception" | "payments" | "auth" | "system" | "alerts";
export type LogSeverity = "all" | "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export interface LogFilters {
  category: LogCategory;
  severity: LogSeverity;
  search: string;
  employeeId: string;
  roomNumber: string;
  dateFrom: string;
  dateTo: string;
  actionType: string;
  timePreset: string;
}

export interface ActionStat {
  action: string;
  count: number;
}

export interface EmployeeStat {
  name: string;
  id: string;
  count: number;
}

export interface HourStat {
  hour: number;
  count: number;
}

export interface LogStats {
  total: number;
  reception: number;
  payments: number;
  auth: number;
  alerts: number;
  byEmployee: EmployeeStat[];
  byAction: ActionStat[];
  byHour: HourStat[];
}

/** Map of UUID → human-readable name (employee name or session label) */
export type NameMap = Map<string, string>;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getDefaultDateFrom(): string {
  return new Date().toISOString().split("T")[0];
}

const DEFAULT_FILTERS: LogFilters = {
  category: "all",
  severity: "all",
  search: "",
  employeeId: "",
  roomNumber: "",
  dateFrom: getDefaultDateFrom(),
  dateTo: "",
  actionType: "",
  timePreset: "today",
};

const CATEGORY_EVENT_TYPES: Record<LogCategory, string[]> = {
  all: [],
  reception: ["RECEPTION_ACTION"],
  payments: ["PAYMENT_CREATED", "PAYMENT_PROCESSED", "PAYMENT_UPDATED", "DATA_CHANGE"],
  auth: ["AUTH_EVENT"],
  system: ["SYSTEM_EVENT", "SYSTEM_MAINTENANCE"],
  alerts: [],
};

// ─── Time Presets ────────────────────────────────────────────────────

function getTimePresetDates(preset: string): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  switch (preset) {
    case "today":
      return { from: today, to: "" };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: y.toISOString().split("T")[0], to: y.toISOString().split("T")[0] };
    }
    case "week": {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      return { from: w.toISOString().split("T")[0], to: "" };
    }
    case "month": {
      const m = new Date(now);
      m.setDate(m.getDate() - 30);
      return { from: m.toISOString().split("T")[0], to: "" };
    }
    default:
      return { from: today, to: "" };
  }
}

// ─── UUID Resolver ───────────────────────────────────────────────────

async function resolveUuids(logs: LogEntry[], existingMap: NameMap): Promise<NameMap> {
  const uuids = new Set<string>();

  for (const log of logs) {
    if (!log.metadata) continue;
    for (const value of Object.values(log.metadata)) {
      if (typeof value === "string" && UUID_REGEX.test(value) && !existingMap.has(value)) {
        uuids.add(value);
      }
    }
  }

  if (uuids.size === 0) return existingMap;

  const supabase = createClient();
  const uuidArray = Array.from(uuids);
  const newMap = new Map(existingMap);

  const { data: employees } = await supabase
    .from("employees")
    .select("id, first_name, last_name")
    .in("id", uuidArray);

  if (employees) {
    for (const emp of employees) {
      newMap.set(emp.id, `${emp.first_name} ${emp.last_name}`);
    }
  }

  const unresolvedIds = uuidArray.filter(id => !newMap.has(id));
  if (unresolvedIds.length > 0) {
    const { data: sessions } = await supabase
      .from("shift_sessions")
      .select("id, employees!shift_sessions_employee_id_fkey(first_name, last_name)")
      .in("id", unresolvedIds);

    if (sessions) {
      for (const session of sessions) {
        const emp = (session as any).employees;
        if (emp) {
          newMap.set(session.id, `Turno de ${emp.first_name} ${emp.last_name}`);
        }
      }
    }
  }

  return newMap;
}

// ─── CSV Export ──────────────────────────────────────────────────────

export function exportLogsToCSV(logs: LogEntry[]) {
  const headers = ["Fecha", "Hora", "Acción", "Empleado", "Habitación", "Monto", "Método Pago", "Severidad", "Descripción"];
  const rows = logs.map(log => [
    new Date(log.created_at).toLocaleDateString("es-MX"),
    new Date(log.created_at).toLocaleTimeString("es-MX"),
    log.action,
    log.employee_name || "",
    log.room_number || "",
    log.amount?.toString() || "",
    log.payment_method || "",
    log.severity,
    (log.description || "").replace(/,/g, ";"),
  ]);

  const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `auditoria_luxor_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useLogCenter() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats>({
    total: 0, reception: 0, payments: 0, auth: 0, alerts: 0,
    byEmployee: [], byAction: [], byHour: [],
  });
  const [filters, setFilters] = useState<LogFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [nameMap, setNameMap] = useState<NameMap>(new Map());
  const nameMapRef = useRef<NameMap>(new Map());
  const PAGE_SIZE = 50;

  const fetchLogs = useCallback(async (reset = false) => {
    const supabase = createClient();
    const currentPage = reset ? 0 : page;
    if (reset) setPage(0);

    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

    // Category filter
    if (filters.category === "alerts") {
      query = query.in("severity", ["WARNING", "ERROR", "CRITICAL"]);
    } else if (filters.category !== "all") {
      const types = CATEGORY_EVENT_TYPES[filters.category];
      if (types.length > 0) query = query.in("event_type", types);
    }

    // Severity
    if (filters.severity !== "all") {
      query = query.eq("severity", filters.severity);
    }

    // Action type
    if (filters.actionType) {
      query = query.eq("action", filters.actionType);
    }

    // Search
    if (filters.search) {
      query = query.or(`description.ilike.%${filters.search}%,employee_name.ilike.%${filters.search}%,action.ilike.%${filters.search}%`);
    }

    // Employee
    if (filters.employeeId) {
      query = query.eq("employee_id", filters.employeeId);
    }

    // Room
    if (filters.roomNumber) {
      query = query.eq("room_number", filters.roomNumber);
    }

    // Date range
    if (filters.dateFrom) {
      query = query.gte("created_at", `${filters.dateFrom}T00:00:00`);
    }
    if (filters.dateTo) {
      query = query.lte("created_at", `${filters.dateTo}T23:59:59`);
    }

    const { data } = await query;
    const newLogs = data || [];
    setHasMore(newLogs.length === PAGE_SIZE);

    if (reset) {
      setLogs(newLogs);
    } else {
      setLogs(prev => [...prev, ...newLogs]);
    }
    setLoading(false);

    // Resolve UUIDs (fire-and-forget)
    resolveUuids(newLogs, nameMapRef.current).then(resolved => {
      if (resolved.size > nameMapRef.current.size) {
        nameMapRef.current = resolved;
        setNameMap(new Map(resolved));
      }
    });
  }, [filters, page]);

  const fetchStats = useCallback(async () => {
    const supabase = createClient();
    const dateFrom = filters.dateFrom || getDefaultDateFrom();

    const { data } = await supabase.rpc("get_audit_stats", {
      p_date_from: `${dateFrom}T00:00:00+00:00`,
    });

    if (data) {
      setStats({
        total: data.total || 0,
        reception: data.reception || 0,
        payments: data.payments || 0,
        auth: data.auth || 0,
        alerts: data.alerts || 0,
        byEmployee: (data.by_employee || []).map((e: any) => ({ name: e.name, id: e.id, count: e.count })),
        byAction: (data.by_action || []).map((a: any) => ({ action: a.action, count: a.count })),
        byHour: (data.by_hour || []).map((h: any) => ({ hour: h.hour, count: h.count })),
      });
    }
  }, [filters.dateFrom]);

  useEffect(() => {
    setLoading(true);
    fetchLogs(true);
    fetchStats();
  }, [filters]);

  const loadMore = () => {
    setPage(p => p + 1);
    fetchLogs(false);
  };

  const updateFilter = (key: keyof LogFilters, value: string) => {
    if (key === "timePreset") {
      const { from, to } = getTimePresetDates(value);
      setFilters(prev => ({ ...prev, timePreset: value, dateFrom: from, dateTo: to }));
    } else {
      setFilters(prev => ({ ...prev, [key]: value, timePreset: key === "dateFrom" || key === "dateTo" ? "custom" : prev.timePreset }));
    }
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const activeFilterCount = [
    filters.search,
    filters.employeeId,
    filters.roomNumber,
    filters.actionType,
    filters.severity !== "all" ? filters.severity : "",
    filters.category !== "all" ? filters.category : "",
  ].filter(Boolean).length;

  return {
    logs, stats, filters, loading, hasMore, nameMap, activeFilterCount,
    updateFilter, resetFilters, loadMore,
    refetch: () => { fetchLogs(true); fetchStats(); },
    exportCSV: () => exportLogsToCSV(logs),
  };
}

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
}

export interface LogStats {
  total: number;
  reception: number;
  payments: number;
  auth: number;
  alerts: number;
  byEmployee: { name: string; count: number }[];
}

/** Map of UUID → human-readable name (employee name or session label) */
export type NameMap = Map<string, string>;

const DEFAULT_FILTERS: LogFilters = {
  category: "all",
  severity: "all",
  search: "",
  employeeId: "",
  roomNumber: "",
  dateFrom: new Date().toISOString().split("T")[0],
  dateTo: "",
};

const CATEGORY_EVENT_TYPES: Record<LogCategory, string[]> = {
  all: [],
  reception: ["RECEPTION_ACTION"],
  payments: ["PAYMENT_CREATED", "PAYMENT_PROCESSED", "PAYMENT_UPDATED", "DATA_CHANGE"],
  auth: ["AUTH_EVENT"],
  system: ["SYSTEM_EVENT", "SYSTEM_MAINTENANCE"],
  alerts: [],
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── UUID Resolver ───────────────────────────────────────────────────
// Scans metadata for UUID values, batch-queries employees and shift_sessions,
// and returns a UUID→Name lookup map.

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

  // Batch query employees by id
  const { data: employees } = await supabase
    .from("employees")
    .select("id, first_name, last_name")
    .in("id", uuidArray);

  if (employees) {
    for (const emp of employees) {
      newMap.set(emp.id, `${emp.first_name} ${emp.last_name}`);
    }
  }

  // For remaining unresolved UUIDs, try shift_sessions → employee name
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

// ─── Hook ────────────────────────────────────────────────────────────

export function useLogCenter() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats>({ total: 0, reception: 0, payments: 0, auth: 0, alerts: 0, byEmployee: [] });
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

    // Severity filter
    if (filters.severity !== "all") {
      query = query.eq("severity", filters.severity);
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

    // Resolve UUIDs in metadata to human names (fire-and-forget)
    resolveUuids(newLogs, nameMapRef.current).then(resolved => {
      if (resolved.size > nameMapRef.current.size) {
        nameMapRef.current = resolved;
        setNameMap(new Map(resolved));
      }
    });
  }, [filters, page]);

  const fetchStats = useCallback(async () => {
    const supabase = createClient();
    const todayStart = filters.dateFrom || new Date().toISOString().split("T")[0];

    const [
      { count: total },
      { count: reception },
      { count: payments },
      { count: auth },
      { count: alerts },
      { data: empData },
    ] = await Promise.all([
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).gte("created_at", `${todayStart}T00:00:00`),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).eq("event_type", "RECEPTION_ACTION").gte("created_at", `${todayStart}T00:00:00`),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).in("event_type", ["PAYMENT_CREATED", "PAYMENT_PROCESSED", "DATA_CHANGE"]).gte("created_at", `${todayStart}T00:00:00`),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).eq("event_type", "AUTH_EVENT").gte("created_at", `${todayStart}T00:00:00`),
      supabase.from("audit_logs").select("*", { count: "exact", head: true }).in("severity", ["WARNING", "ERROR", "CRITICAL"]).gte("created_at", `${todayStart}T00:00:00`),
      supabase.from("audit_logs").select("employee_name").not("employee_name", "is", null).gte("created_at", `${todayStart}T00:00:00`),
    ]);

    const empMap = new Map<string, number>();
    (empData || []).forEach((e: any) => {
      if (e.employee_name) empMap.set(e.employee_name, (empMap.get(e.employee_name) || 0) + 1);
    });
    const byEmployee = Array.from(empMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setStats({
      total: total || 0,
      reception: reception || 0,
      payments: payments || 0,
      auth: auth || 0,
      alerts: alerts || 0,
      byEmployee,
    });
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
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  return { logs, stats, filters, loading, hasMore, nameMap, updateFilter, resetFilters, loadMore, refetch: () => { fetchLogs(true); fetchStats(); } };
}



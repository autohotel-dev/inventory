import { apiClient } from "@/lib/api/client";
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
    const { apiClient } = await import("@/lib/api/client");
    const currentPage = reset ? 0 : page;
    if (reset) setPage(0);

    try {
      const { data: responseData } = await apiClient.get('/system/logs', {
        params: {
          page: currentPage,
          limit: PAGE_SIZE,
          category: filters.category,
          severity: filters.severity,
          search: filters.search || undefined,
          employee_id: filters.employeeId || undefined,
          room_number: filters.roomNumber || undefined,
          date_from: filters.dateFrom || undefined,
          date_to: filters.dateTo || undefined
        }
      }) as any;
      
      const newLogs = responseData.items || [];
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
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, [filters, page]);

  const fetchStats = useCallback(async () => {
    const { apiClient } = await import("@/lib/api/client");
    const todayStart = filters.dateFrom || new Date().toISOString().split("T")[0];

    try {
      const { data } = await apiClient.get('/system/logs/stats', {
        params: { date_from: todayStart }
      }) as any;
      setStats(data);
    } catch (e) {
      console.error(e);
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
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  return { logs, stats, filters, loading, hasMore, nameMap, updateFilter, resetFilters, loadMore, refetch: () => { fetchLogs(true); fetchStats(); } };
}



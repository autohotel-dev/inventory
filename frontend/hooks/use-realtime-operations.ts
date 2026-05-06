"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FlowEvent } from "./use-flow-timeline";
import { luxorRealtimeClient } from "@/lib/api/websocket";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OperationFlow {
  id: string;
  flow_number: number;
  room_stay_id: string | null;
  sales_order_id: string | null;
  room_id: string | null;
  room_number: string;
  status: "ACTIVO" | "COMPLETADO" | "CANCELADO";
  current_stage: string;
  started_at: string;
  completed_at: string | null;
  shift_session_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Inline events (fetched together)
  events?: FlowEvent[];
}

export interface OperationStats {
  activeFlows: number;
  completedToday: number;
  cancelledToday: number;
  avgDurationMinutes: number;
}

export interface EmployeeOption {
  id: string;
  name: string;
  role: string;
}

export interface ShiftOption {
  id: string;
  label: string;
  employee_name: string;
  clock_in: string;
}

export type FlowStatusFilter = "all" | "ACTIVO" | "COMPLETADO" | "CANCELADO";

export interface OperationFilters {
  status: FlowStatusFilter;
  roomNumber: string;
  search: string;
  dateFrom: string;
  dateTo: string;
  employeeName: string;  // Filter by actor_name in flow_events
  shiftId: string;       // Filter by shift_session_id
}

const DEFAULT_FILTERS: OperationFilters = {
  status: "all",
  roomNumber: "",
  search: "",
  dateFrom: new Date().toISOString().split("T")[0],
  dateTo: "",
  employeeName: "",
  shiftId: "",
};

const PAGE_SIZE = 30;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRealtimeOperations() {
  const [flows, setFlows] = useState<OperationFlow[]>([]);
  const [stats, setStats] = useState<OperationStats>({
    activeFlows: 0,
    completedToday: 0,
    cancelledToday: 0,
    avgDurationMinutes: 0,
  });
  const [filters, setFilters] = useState<OperationFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedFlowIds, setExpandedFlowIds] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(true);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);

  // ─── Fetch Employees for Filter ────────────────────────────────────────

  const fetchEmployees = useCallback(async () => {
    try {
      const { apiClient } = await import("@/lib/api/client");
      const { data } = await apiClient.get('/system/crud/employees');
      if (data) {
        setEmployees(
          data.map((e: any) => ({
            id: e.id,
            name: `${e.first_name} ${e.last_name}`.trim(),
            role: e.role || "",
          }))
        );
      }
    } catch(e) {}
  }, []);

  // ─── Fetch Shifts for Filter ───────────────────────────────────────────

  const fetchShifts = useCallback(async () => {
    try {
      const { apiClient } = await import("@/lib/api/client");
      const todayStart = `${filters.dateFrom || new Date().toISOString().split("T")[0]}T00:00:00`;
      const { data } = await apiClient.get(`/system/crud/shift_sessions?limit=20`); // gte clock_in_at would need advanced query string but let's fetch recent
      
      if (data) {
        setShifts(
          data.map((s: any) => {
            const emp = s.employees;
            const empName = emp ? `${emp.first_name} ${emp.last_name}`.trim() : "Desconocido";
            const clockIn = new Date(s.clock_in_at).toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return {
              id: s.id,
              label: `${empName} — ${clockIn} (${s.status})`,
              employee_name: empName,
              clock_in: s.clock_in_at,
            };
          })
        );
      }
    } catch(e) {}
  }, [filters.dateFrom]);

  // ─── Fetch Flows WITH Events ───────────────────────────────────────────

  const fetchFlows = useCallback(
    async (reset = false) => {
      const currentPage = reset ? 0 : page;
      if (reset) setPage(0);

      setLoading(true);

      try {
        const { apiClient } = await import("@/lib/api/client");
        // Convert filters to query string params if needed
        const { data } = await apiClient.get(`/system/crud/operation_flows`);

        let newFlows = (data || []) as OperationFlow[];
        
        // Manual filtering since apiClient doesn't have fluent query builder
        if (filters.status !== "all") {
          newFlows = newFlows.filter((f) => f.status === filters.status);
        }
        if (filters.roomNumber) {
          newFlows = newFlows.filter((f) => f.room_number === filters.roomNumber);
        }
        if (filters.shiftId) {
          newFlows = newFlows.filter((f) => f.shift_session_id === filters.shiftId);
        }
        if (filters.search) {
          const search = filters.search.toLowerCase();
          const searchNum = parseInt(search.replace(/^F/i, ""), 10);
          newFlows = newFlows.filter((f) => {
             const m1 = !isNaN(searchNum) && f.flow_number === searchNum;
             const m2 = f.room_number?.toLowerCase().includes(search);
             return m1 || m2;
          });
        }
        if (filters.dateFrom) {
          const fromTime = new Date(`${filters.dateFrom}T00:00:00`).getTime();
          newFlows = newFlows.filter((f) => new Date(f.started_at).getTime() >= fromTime);
        }
        if (filters.dateTo) {
          const toTime = new Date(`${filters.dateTo}T23:59:59`).getTime();
          newFlows = newFlows.filter((f) => new Date(f.started_at).getTime() <= toTime);
        }

        setHasMore(newFlows.length >= PAGE_SIZE); // Mocking pagination behavior locally for now
        newFlows = newFlows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

        if (newFlows.length > 0) {
          const flowIds = newFlows.map((f) => f.id);
          const { data: allEvents } = await apiClient.get(`/system/crud/flow_events`);
          
          if (allEvents) {
            const filteredEvents = allEvents.filter((e: any) => flowIds.includes(e.flow_id));
            const eventsByFlow = new Map<string, FlowEvent[]>();
            for (const evt of filteredEvents as FlowEvent[]) {
              const existing = eventsByFlow.get(evt.flow_id as unknown as string) || [];
              existing.push(evt);
              eventsByFlow.set(evt.flow_id as unknown as string, existing);
            }

            newFlows = newFlows.map((f) => ({
              ...f,
              events: eventsByFlow.get(f.id) || [],
            }));
          }

          if (filters.employeeName) {
            const search = filters.employeeName.toLowerCase();
            newFlows = newFlows.filter((f) =>
              f.events?.some((e) =>
                e.actor_name?.toLowerCase().includes(search)
              )
            );
          }
        }

        if (reset) {
          setFlows(newFlows);
        } else {
          setFlows((prev) => [...prev, ...newFlows]);
        }
      } catch (error) {
        console.error("[useRealtimeOperations] Error fetching flows:", error);
      } finally {
        setLoading(false);
      }
    },
    [filters, page]
  );

  // ─── Fetch Stats ─────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const { apiClient } = await import("@/lib/api/client");
      const { data } = await apiClient.get('/system/crud/operation_flows');
      const allFlows = data || [];
      const todayStart = new Date(`${new Date().toISOString().split("T")[0]}T00:00:00`).getTime();

      let activeCount = 0;
      let completedCount = 0;
      let cancelledCount = 0;
      let totalDuration = 0;
      let completedWithDuration = 0;

      for (const f of allFlows) {
        if (f.status === "ACTIVO") activeCount++;
        const completedTime = f.completed_at ? new Date(f.completed_at).getTime() : null;
        if (completedTime && completedTime >= todayStart) {
           if (f.status === "COMPLETADO") completedCount++;
           if (f.status === "CANCELADO") cancelledCount++;
           if (f.status === "COMPLETADO" && f.started_at) {
             totalDuration += (completedTime - new Date(f.started_at).getTime());
             completedWithDuration++;
           }
        }
      }

      setStats({
        activeFlows: activeCount,
        completedToday: completedCount,
        cancelledToday: cancelledCount,
        avgDurationMinutes: completedWithDuration > 0 ? Math.round(totalDuration / completedWithDuration / 60000) : 0,
      });
    } catch(e) {}
  }, []);

  // ─── Realtime Subscription ───────────────────────────────────────────────

  useEffect(() => {
    let debounceTimeout: NodeJS.Timeout;

    const unsubFlows = luxorRealtimeClient.subscribe("operation_flows", () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        fetchFlows(true);
        fetchStats();
      }, 500);
    });

    const unsubEvents = luxorRealtimeClient.subscribe("flow_events", (payload) => {
      if (payload.type === "INSERT") {
        const newEvent = payload.record as FlowEvent;
        if (newEvent?.flow_id) {
          setFlows((prev) =>
            prev.map((f) => {
              if (f.id === (newEvent.flow_id as unknown as string)) {
                const updatedEvents = [...(f.events || [])];
                if (!updatedEvents.some((e) => e.id === newEvent.id)) {
                  updatedEvents.push(newEvent);
                }
                return {
                  ...f,
                  current_stage: newEvent.event_type,
                  updated_at: newEvent.created_at,
                  events: updatedEvents,
                };
              }
              return f;
            })
          );
        }
      }
    });

    setIsConnected(true);

    return () => {
      clearTimeout(debounceTimeout);
      unsubFlows();
      unsubEvents();
    };
  }, [fetchFlows, fetchStats]);

  // ─── Initial Fetch ───────────────────────────────────────────────────────

  useEffect(() => {
    fetchFlows(true);
    fetchStats();
  }, [filters]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  // ─── Expand / Collapse ─────────────────────────────────────────────────

  const toggleExpanded = (flowId: string) => {
    setExpandedFlowIds((prev) => {
      const next = new Set(prev);
      if (next.has(flowId)) {
        next.delete(flowId);
      } else {
        next.add(flowId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedFlowIds(new Set(flows.map((f) => f.id)));
  };

  const collapseAll = () => {
    setExpandedFlowIds(new Set());
  };

  // ─── Public API ──────────────────────────────────────────────────────────

  const loadMore = () => {
    setPage((p) => p + 1);
    fetchFlows(false);
  };

  const updateFilter = (key: keyof OperationFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const refetch = () => {
    fetchFlows(true);
    fetchStats();
  };

  return {
    flows,
    stats,
    filters,
    loading,
    hasMore,
    isConnected,
    expandedFlowIds,
    employees,
    shifts,
    toggleExpanded,
    expandAll,
    collapseAll,
    updateFilter,
    resetFilters,
    loadMore,
    refetch,
  };
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { FlowEvent } from "./use-flow-timeline";

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
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // ─── Fetch Employees for Filter ────────────────────────────────────────

  const fetchEmployees = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name, role")
      ;

    if (data) {
      setEmployees(
        data.map((e: any) => ({
          id: e.id,
          name: `${e.first_name} ${e.last_name}`.trim(),
          role: e.role || "",
        }))
      );
    }
  }, []);

  // ─── Fetch Shifts for Filter ───────────────────────────────────────────

  const fetchShifts = useCallback(async () => {
    const supabase = createClient();
    const todayStart = `${filters.dateFrom || new Date().toISOString().split("T")[0]}T00:00:00`;

    const { data } = await supabase
      .from("shift_sessions")
      .select("id, clock_in_at, status, employees!shift_sessions_employee_id_fkey(first_name, last_name)")
      .gte("clock_in_at", todayStart)
      
      .limit(20);

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
  }, [filters.dateFrom]);

  // ─── Fetch Flows WITH Events ───────────────────────────────────────────

  const fetchFlows = useCallback(
    async (reset = false) => {
      const supabase = createClient();
      const currentPage = reset ? 0 : page;
      if (reset) setPage(0);

      setLoading(true);

      let query = supabase
        .from("operation_flows")
        .select("*")
        
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      // Status filter
      if (filters.status !== "all") {
        query = query;
      }

      // Room number filter
      if (filters.roomNumber) {
        query = query;
      }

      // Shift filter
      if (filters.shiftId) {
        query = query;
      }

      // Search by flow_number or room_number
      if (filters.search) {
        const searchNum = parseInt(filters.search.replace(/^F/i, ""), 10);
        if (!isNaN(searchNum)) {
          query = query.or(
            `flow_number.eq.${searchNum},room_number.ilike.%${filters.search}%`
          );
        } else {
          query = query.ilike("room_number", `%${filters.search}%`);
        }
      }

      // Date range
      if (filters.dateFrom) {
        query = query.gte("started_at", `${filters.dateFrom}T00:00:00`);
      }
      if (filters.dateTo) {
        query = query.lte("started_at", `${filters.dateTo}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("[useRealtimeOperations] Error fetching flows:", error);
        setLoading(false);
        return;
      }

      let newFlows = (data || []) as OperationFlow[];
      setHasMore(newFlows.length === PAGE_SIZE);

      // Fetch events for all flows in parallel
      if (newFlows.length > 0) {
        const flowIds = newFlows.map((f) => f.id);
        const { data: allEvents } = await supabase
          .from("flow_events")
          .select("*")
          .in("flow_id", flowIds)
          ;

        if (allEvents) {
          const eventsByFlow = new Map<string, FlowEvent[]>();
          for (const evt of allEvents as FlowEvent[]) {
            const existing = eventsByFlow.get(evt.flow_id as unknown as string) || [];
            existing.push(evt);
            eventsByFlow.set(evt.flow_id as unknown as string, existing);
          }

          // Attach events to each flow
          newFlows = newFlows.map((f) => ({
            ...f,
            events: eventsByFlow.get(f.id) || [],
          }));
        }

        // Employee name filter: keep only flows that have events by this employee
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

      setLoading(false);
    },
    [filters, page]
  );

  // ─── Fetch Stats ─────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    const supabase = createClient();
    const todayStart = `${new Date().toISOString().split("T")[0]}T00:00:00`;

    const [activeRes, completedRes, cancelledRes, durationRes] =
      await Promise.all([
        supabase
          .from("operation_flows")
          .select("*", { count: "exact", head: true })
          ,
        supabase
          .from("operation_flows")
          .select("*", { count: "exact", head: true })
          
          .gte("completed_at", todayStart),
        supabase
          .from("operation_flows")
          .select("*", { count: "exact", head: true })
          
          .gte("completed_at", todayStart),
        supabase
          .from("operation_flows")
          .select("started_at, completed_at")
          
          
          .gte("completed_at", todayStart)
          .limit(50),
      ]);

    let avgDuration = 0;
    const completedFlows = durationRes.data || [];
    if (completedFlows.length > 0) {
      const totalMs = completedFlows.reduce((sum: number, f: any) => {
        const start = new Date(f.started_at).getTime();
        const end = new Date(f.completed_at).getTime();
        return sum + (end - start);
      }, 0);
      avgDuration = Math.round(totalMs / completedFlows.length / 60000);
    }

    setStats({
      activeFlows: activeRes.count || 0,
      completedToday: completedRes.count || 0,
      cancelledToday: cancelledRes.count || 0,
      avgDurationMinutes: avgDuration,
    });
  }, []);

  // ─── Realtime Subscription ───────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();
    let debounceTimeout: NodeJS.Timeout;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel("realtime-operations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operation_flows" },
        () => {
          clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(() => {
            fetchFlows(true);
            fetchStats();
          }, 500);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "flow_events" },
        (payload: { new: Record<string, any> }) => {
          const newEvent = payload.new as FlowEvent;
          if (newEvent?.flow_id) {
            // Append the new event to the matching flow inline
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
      )
      .subscribe((status: string) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      clearTimeout(debounceTimeout);
      supabase.removeChannel(channel);
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

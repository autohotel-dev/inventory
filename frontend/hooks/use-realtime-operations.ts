"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

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
  // Joined data
  _event_count?: number;
  _last_event?: string;
  _last_actor?: string;
  _duration_ms?: number;
}

export interface OperationStats {
  activeFlows: number;
  completedToday: number;
  cancelledToday: number;
  avgDurationMinutes: number;
}

export type FlowStatusFilter = "all" | "ACTIVO" | "COMPLETADO" | "CANCELADO";

export interface OperationFilters {
  status: FlowStatusFilter;
  roomNumber: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: OperationFilters = {
  status: "all",
  roomNumber: "",
  search: "",
  dateFrom: new Date().toISOString().split("T")[0],
  dateTo: "",
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
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // ─── Fetch Flows ─────────────────────────────────────────────────────────

  const fetchFlows = useCallback(
    async (reset = false) => {
      const supabase = createClient();
      const currentPage = reset ? 0 : page;
      if (reset) setPage(0);

      setLoading(true);

      let query = supabase
        .from("operation_flows")
        .select("*")
        .order("started_at", { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      // Status filter
      if (filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      // Room number filter
      if (filters.roomNumber) {
        query = query.eq("room_number", filters.roomNumber);
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

      const newFlows = (data || []) as OperationFlow[];
      setHasMore(newFlows.length === PAGE_SIZE);

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
          .eq("status", "ACTIVO"),
        supabase
          .from("operation_flows")
          .select("*", { count: "exact", head: true })
          .eq("status", "COMPLETADO")
          .gte("completed_at", todayStart),
        supabase
          .from("operation_flows")
          .select("*", { count: "exact", head: true })
          .eq("status", "CANCELADO")
          .gte("completed_at", todayStart),
        supabase
          .from("operation_flows")
          .select("started_at, completed_at")
          .eq("status", "COMPLETADO")
          .not("completed_at", "is", null)
          .gte("completed_at", todayStart)
          .limit(50),
      ]);

    // Calculate average duration
    let avgDuration = 0;
    const completedFlows = durationRes.data || [];
    if (completedFlows.length > 0) {
      const totalMs = completedFlows.reduce((sum: number, f: any) => {
        const start = new Date(f.started_at).getTime();
        const end = new Date(f.completed_at).getTime();
        return sum + (end - start);
      }, 0);
      avgDuration = Math.round(totalMs / completedFlows.length / 60000); // to minutes
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

    // Clean up previous channel
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
          // When a new event comes in, update the matching flow's current_stage
          const newEvent = payload.new as any;
          if (newEvent?.flow_id) {
            setFlows((prev) =>
              prev.map((f) =>
                f.id === newEvent.flow_id
                  ? {
                      ...f,
                      current_stage: newEvent.event_type,
                      updated_at: newEvent.created_at,
                      _last_event: newEvent.description,
                      _last_actor: newEvent.actor_name,
                    }
                  : f
              )
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
    selectedFlowId,
    setSelectedFlowId,
    updateFilter,
    resetFilters,
    loadMore,
    refetch,
  };
}

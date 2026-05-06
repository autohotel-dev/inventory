"use client";

import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import { luxorRealtimeClient } from "@/lib/api/websocket";
import { toast } from "sonner";

export interface LiveOperationFlow {
  id: string; // The room_stay.id
  visualId: string; // e.g. FL-A1B2C3
  roomNumber: string;
  status: string;
  checkInAt: string;
  checkOutAt?: string;
  expectedCheckOutAt?: string;
  vehiclePlate?: string;
  valetEmployeeId?: string;
  receptionEmployeeId?: string | null;
  roomId?: string;
  events: LiveOperationEvent[];
}

export interface LiveOperationEvent {
  id: string;
  action: string;
  severity: string;
  createdAt: string;
  description?: string;
  metadata?: Record<string, any>;
  employeeName?: string;
  amount?: number;
}

export interface LiveOperationFilters {
  status?: string; // "ALL", "ACTIVA", "CERRADA", etc.
  shiftId?: string; // ID of the shift session
}

export function useLiveOperations() {
  const [flows, setFlows] = useState<LiveOperationFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<LiveOperationFilters>({ status: 'ALL', shiftId: 'ALL' });

  const fetchFlows = useCallback(async (currentFilters?: LiveOperationFilters, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const activeFilters = currentFilters || filters;

    try {
      const { data: flowsData } = await apiClient.get('/rooms/live-operations/flows', {
        params: {
          status: activeFilters?.status,
          shift_id: activeFilters?.shiftId
        }
      }) as any;

      if (!flowsData || !Array.isArray(flowsData)) {
        setFlows([]);
        return;
      }

      setFlows(flowsData);
    } catch (error) {
      console.error("Error fetching live operations:", error);
      toast.error("Error al cargar las operaciones");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchFlows();
    
    // Subscribe to realtime changes in operations
    const handleFlowsUpdate = () => {
      fetchFlows(filters, true);
    };

    const handleAuditLogsUpdate = (payload: any) => {
      if (payload.type === 'INSERT') {
        fetchFlows(filters, true);
      }
    };

    const unsubStays = luxorRealtimeClient.subscribe('room_stays', handleFlowsUpdate);
    const unsubLogs = luxorRealtimeClient.subscribe('audit_logs', handleAuditLogsUpdate);
    const unsubPayments = luxorRealtimeClient.subscribe('payments', handleFlowsUpdate);
    const unsubItems = luxorRealtimeClient.subscribe('sales_order_items', handleFlowsUpdate);

    return () => {
      unsubStays();
      unsubLogs();
      unsubPayments();
      unsubItems();
    };
  }, [fetchFlows, filters]);

  return {
    flows,
    loading,
    refreshing,
    filters,
    setFilters,
    fetchFlows,
    refreshFlows: () => fetchFlows(filters, true)
  };
}

export async function fetchRecentReceptionShifts() {
  try {
    const { data } = await apiClient.get('/rooms/shifts/recent-reception') as any;
    return data || [];
  } catch (error) {
    console.error("Error fetching recent reception shifts:", error);
    return [];
  }
}

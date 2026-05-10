"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export interface LiveOperationFlow {
  id: string; // The room_stay.id
  visualId: string; // e.g. FL-A1B2C3
  roomId: string;
  roomNumber: string;
  status: string;
  checkInAt: string;
  checkOutAt?: string;
  expectedCheckOutAt?: string;
  vehiclePlate?: string;
  valetEmployeeId?: string;
  receptionEmployeeId?: string | null;
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
  employeeRole?: string;
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
      const supabase = createClient();
      
      const { data, error } = await supabase.rpc('get_live_operations', {
        p_limit: activeFilters.shiftId && activeFilters.shiftId !== 'ALL' ? 200 : 50,
        p_status: activeFilters.status || 'ALL',
        p_shift_id: activeFilters.shiftId !== 'ALL' ? activeFilters.shiftId : null
      });

      if (error) throw error;

      setFlows(data || []);
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

    const supabase = createClient();
    
    // Subscribe to realtime changes in operations
    const channel = supabase.channel('live-operations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_stays' }, () => fetchFlows(filters, true))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => fetchFlows(filters, true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchFlows(filters, true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_order_items' }, () => fetchFlows(filters, true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
  const supabase = createClient();
  const { data, error } = await supabase
    .from('shift_sessions')
    .select('id, clock_in_at, clock_out_at, status, employees!inner(first_name, last_name, role)')
    .in('employees.role', ['receptionist', 'admin', 'manager'])
    .order('clock_in_at', { ascending: false })
    .limit(20);
    
  if (error) {
    console.error("Error fetching shifts:", error);
    return [];
  }
  return data || [];
}

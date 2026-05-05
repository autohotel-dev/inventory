import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface TelemetryRecord {
  id: string;
  user_id: string | null;
  module: string | null;
  page: string;
  action_type: 'UI_CLICK' | 'API_REQUEST' | 'PAGE_VIEW';
  action_name: string | null;
  duration_ms: number | null;
  payload: unknown;
  endpoint: string | null;
  is_success: boolean | null;
  error_details: unknown;
  created_at: string;
  employee_name?: string; // Resolved from employees table
}

export interface TelemetryFilters {
  action_type: 'ALL' | 'UI_CLICK' | 'API_REQUEST' | 'PAGE_VIEW';
  module: string;
  status: 'ALL' | 'SUCCESS' | 'ERROR';
  search: string;
  user_id: string | 'ALL';
  date_from: string | null;
  date_to: string | null;
}

export function useTelemetry() {
  const [data, setData] = useState<TelemetryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const PAGE_SIZE = 100;

  // Metadata for dropdowns
  const [employeesList, setEmployeesList] = useState<{id: string, name: string}[]>([]);
  const [shiftsList, setShiftsList] = useState<{id: string, name: string, start: string, end: string | null}[]>([]);

  const [filters, setFilters] = useState<TelemetryFilters>({
    action_type: 'ALL',
    module: 'ALL',
    status: 'ALL',
    search: '',
    user_id: 'ALL',
    date_from: null,
    date_to: null,
  });

  const [stats, setStats] = useState({
    total: 0,
    errors: 0,
    avgDuration: 0,
  });

  // Fetch metadata once
  useEffect(() => {
    const fetchMetadata = async () => {
      const supabase = createClient();
      
      const { data: emps } = await supabase.from('employees').select('auth_user_id, first_name, last_name');
      if (emps) {
        setEmployeesList(
          emps
            .filter((e: any) => e.auth_user_id != null)
            .map((e: any) => ({ id: e.auth_user_id, name: `${e.first_name} ${e.last_name}`.trim() }))
        );
      }

      const { data: shifts } = await supabase
        .from('shift_sessions')
        .select('id, clock_in_at, clock_out_at, employees(first_name, last_name)')
        .order('clock_in_at', { ascending: false })
        .limit(20);
      
      if (shifts) {
        setShiftsList(shifts.map((s: any) => ({
          id: s.id,
          name: `${s.employees?.first_name || 'Turno'} - ${new Date(s.clock_in_at).toLocaleDateString()}`,
          start: s.clock_in_at,
          end: s.clock_out_at
        })));
      }
    };
    fetchMetadata();
  }, []);

  const fetchTelemetry = useCallback(async (isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setLoading(true);
      }
      
      const supabase = createClient();
      let query = supabase
        .from("system_telemetry")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      // Apply Filters
      if (filters.action_type !== 'ALL') {
        query = query.eq('action_type', filters.action_type);
      }
      if (filters.module !== 'ALL') {
        query = query.eq('module', filters.module);
      }
      if (filters.status === 'SUCCESS') {
        query = query.eq('is_success', true);
      }
      if (filters.status === 'ERROR') {
        query = query.eq('is_success', false);
      }
      if (filters.user_id !== 'ALL') {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }
      if (filters.search) {
        // ILIKE search on action_name or endpoint
        query = query.or(`action_name.ilike.%${filters.search}%,endpoint.ilike.%${filters.search}%`);
      }

      // Pagination
      const from = (isLoadMore ? pageIndex + 1 : 0) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data: rawData, error, count } = await query;

      if (error) throw error;

      // Try to resolve user IDs to employee names
      let enrichedData: TelemetryRecord[] = rawData as TelemetryRecord[];
      
      const userIds = [...new Set(rawData.map((r: TelemetryRecord) => r.user_id).filter(Boolean))] as string[];
      if (userIds.length > 0) {
        const { data: employees } = await supabase
          .from('employees')
          .select('auth_user_id, first_name, last_name')
          .in('auth_user_id', userIds);

        if (employees) {
          const empMap = new Map(employees.map((e: { auth_user_id: string; first_name: string; last_name: string }) => [e.auth_user_id, `${e.first_name} ${e.last_name}`.trim()]));
          enrichedData = rawData.map((r: TelemetryRecord) => ({
            ...r,
            employee_name: r.user_id && empMap.has(r.user_id) ? empMap.get(r.user_id) : 'Sistema / Anónimo'
          }));
        }
      }

      if (isLoadMore) {
        setData(prev => [...prev, ...enrichedData]);
        setPageIndex(prev => prev + 1);
      } else {
        setData(enrichedData);
        setPageIndex(0);
        
        // Calculate basic stats for the first page
        const errs = enrichedData.filter(d => d.is_success === false).length;
        const durations = enrichedData.map(d => d.duration_ms).filter(Boolean) as number[];
        const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
        
        setStats({
          total: count || enrichedData.length,
          errors: errs,
          avgDuration: avg,
        });
      }

      setHasMore(count ? from + PAGE_SIZE < count : false);
    } catch (error) {
      console.error("Error fetching telemetry:", error);
    } finally {
      setLoading(false);
    }
  }, [filters, pageIndex]);

  useEffect(() => {
    fetchTelemetry(false);
  }, [filters, fetchTelemetry]);

  const updateFilter = (key: keyof TelemetryFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const loadMore = () => fetchTelemetry(true);
  const refresh = () => fetchTelemetry(false);

  return {
    data,
    loading,
    hasMore,
    filters,
    stats,
    employeesList,
    shiftsList,
    updateFilter,
    loadMore,
    refresh
  };
}

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";
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
      try {
        const { apiClient } = await import("@/lib/api/client");
        const { data } = await apiClient.get('/system/telemetry/metadata') as any;
        setEmployeesList(data.employees || []);
        setShiftsList(data.shifts || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchMetadata();
  }, []);

  const fetchTelemetry = useCallback(async (isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setLoading(true);
      }
      
      const { apiClient } = await import("@/lib/api/client");
      const from = isLoadMore ? pageIndex + 1 : 0;
      const { data: responseData } = await apiClient.get('/system/telemetry', {
        params: {
          page: from,
          limit: PAGE_SIZE,
          action_type: filters.action_type,
          module: filters.module,
          status: filters.status,
          search: filters.search || undefined,
          user_id: filters.user_id,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined
        }
      }) as any;
      
      let enrichedData: TelemetryRecord[] = responseData.items || [];
      const count = responseData.total || 0;

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

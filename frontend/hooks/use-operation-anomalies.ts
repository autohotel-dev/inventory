"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface OperationAnomaly {
  flow_id: string;
  room_number: string;
  anomaly_type: string;
  severity: string;
  description: string;
  details: Record<string, unknown>;
  detected_at: string;
}

export function useOperationAnomalies() {
  const [anomalies, setAnomalies] = useState<OperationAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [criticalCount, setCriticalCount] = useState(0);
  const [highCount, setHighCount] = useState(0);

  const fetchAnomalies = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_operation_anomalies");

      if (error) {
        console.error("[anomalies] Error fetching:", error.message);
        return;
      }

      const list = (data || []) as OperationAnomaly[];
      setAnomalies(list);
      setCriticalCount(list.filter(a => a.severity === "CRITICAL").length);
      setHighCount(list.filter(a => a.severity === "HIGH").length);
    } catch (err) {
      console.error("[anomalies] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnomalies();
    const interval = setInterval(fetchAnomalies, 30000);
    return () => clearInterval(interval);
  }, [fetchAnomalies]);

  return {
    anomalies,
    loading,
    criticalCount,
    highCount,
    totalAnomalies: anomalies.length,
    refresh: fetchAnomalies,
  };
}

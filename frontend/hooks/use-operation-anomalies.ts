"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface OperationAnomaly {
  flow_id?: string;
  room_number?: string;
  pair_key?: string;
  anomaly_type: string;
  severity: string;
  description: string;
  details: Record<string, unknown>;
  detected_at: string;
}

export function useOperationAnomalies() {
  const [anomalies, setAnomalies] = useState<OperationAnomaly[]>([]);
  const [collusionPatterns, setCollusionPatterns] = useState<OperationAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [criticalCount, setCriticalCount] = useState(0);
  const [highCount, setHighCount] = useState(0);
  const [collusionCount, setCollusionCount] = useState(0);

  const fetchAnomalies = useCallback(async () => {
    try {
      const supabase = createClient();

      const [anomalyResult, collusionResult] = await Promise.all([
        supabase.rpc("get_operation_anomalies"),
        supabase.rpc("get_collusion_patterns"),
      ]);

      if (anomalyResult.error) {
        console.error("[anomalies] Error fetching anomalies:", anomalyResult.error.message);
      } else {
        const list = (anomalyResult.data || []) as OperationAnomaly[];
        setAnomalies(list);
      }

      if (collusionResult.error) {
        console.error("[anomalies] Error fetching collusion:", collusionResult.error.message);
      } else {
        const list = (collusionResult.data || []) as OperationAnomaly[];
        setCollusionPatterns(list);
        setCollusionCount(list.length);
      }

      const allAnomalies = [
        ...((anomalyResult.data || []) as OperationAnomaly[]),
        ...((collusionResult.data || []) as OperationAnomaly[]),
      ];
      setCriticalCount(allAnomalies.filter(a => a.severity === "CRITICAL").length);
      setHighCount(allAnomalies.filter(a => a.severity === "HIGH").length);
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
    collusionPatterns,
    loading,
    criticalCount,
    highCount,
    collusionCount,
    totalAnomalies: anomalies.length + collusionPatterns.length,
    refresh: fetchAnomalies,
  };
}

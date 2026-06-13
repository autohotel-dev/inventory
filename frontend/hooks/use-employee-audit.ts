"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface EmployeeActivityLog {
  log_id: string;
  employee_id: string;
  employee_name: string;
  employee_role: string;
  action_type: string;
  action_category: string;
  entity_type: string;
  entity_id: string;
  room_number: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface HistoricalAnomaly {
  employee_id: string;
  employee_name: string;
  employee_role: string;
  anomaly_type: string;
  severity: string;
  occurrence_count: number;
  total_amount: number;
  description: string;
  sample_flow_ids: string[];
  first_seen: string;
  last_seen: string;
}

export interface EmployeeRiskSummary {
  employee_id: string;
  employee_name: string;
  employee_role: string;
  risk_score: number;
  risk_level: string;
  total_operations: number;
  anomalies_detected: number;
  incidents_reported: number;
  payment_discrepancies: number;
  person_mismatches: number;
  courtesy_abuse_count: number;
  fast_checkout_count: number;
  activity_summary: Record<string, unknown>;
  recent_incidents: Array<{
    title: string;
    severity: string;
    status: string;
    created_at: string;
    incident_type: string;
  }>;
}

export interface IncidentReport {
  id: string;
  incident_number: number;
  reported_by: string;
  reported_by_name: string;
  target_employee_id: string;
  target_employee_name: string;
  incident_type: string;
  severity: string;
  title: string;
  description: string;
  evidence_type: string;
  evidence_url: string;
  evidence_notes: string;
  room_number: string;
  amount_involved: number;
  status: string;
  resolution_notes: string;
  created_at: string;
  updated_at: string;
}

export function useEmployeeAuditTrail(employeeId: string | null, dateRange?: { from: Date; to: Date }) {
  const [logs, setLogs] = useState<EmployeeActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!employeeId) { setLogs([]); setLoading(false); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_employee_audit_trail", {
        p_employee_id: employeeId,
        p_date_from: dateRange?.from?.toISOString() || new Date(Date.now() - 7 * 86400000).toISOString(),
        p_date_to: dateRange?.to?.toISOString() || new Date().toISOString(),
      });
      if (!error) setLogs(data || []);
    } catch (err) {
      console.error("[audit] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [employeeId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  return { logs, loading, refresh: fetchLogs };
}

export function useHistoricalAnomalies(days: number = 30) {
  const [anomalies, setAnomalies] = useState<HistoricalAnomaly[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("scan_historical_anomalies", { p_days: days });
      if (!error) setAnomalies(data || []);
    } catch (err) {
      console.error("[audit] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchAnomalies(); }, [fetchAnomalies]);
  return { anomalies, loading, refresh: fetchAnomalies };
}

export function useEmployeeRiskOverview() {
  const [employees, setEmployees] = useState<EmployeeRiskSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_all_employees_risk_overview");
      if (!error && data) {
        // Map out_ prefixed columns to expected names
        const mapped = data.map((row: any) => ({
          employee_id: row.out_employee_id,
          employee_name: row.out_employee_name,
          employee_role: row.out_employee_role,
          risk_score: Number(row.out_risk_score) || 0,
          risk_level: row.out_risk_level || 'LOW',
          total_operations: row.out_total_operations || 0,
          anomalies_detected: row.out_anomalies_detected || 0,
          incidents_reported: row.out_incidents_reported || 0,
          payment_discrepancies: row.out_payment_discrepancies || 0,
          person_mismatches: row.out_person_mismatches || 0,
          courtesy_abuse_count: row.out_courtesy_abuse_count || 0,
          fast_checkout_count: row.out_fast_checkout_count || 0,
          activity_summary: row.out_activity_summary || {},
          recent_incidents: row.out_recent_incidents || [],
        }));
        setEmployees(mapped);
      }
    } catch (err) {
      console.error("[audit] Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  return { employees, loading, refresh: fetchOverview };
}

export function useIncidentReports(filters?: { status?: string; employeeId?: string }) {
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase.from("incident_reports").select("*").order("created_at", { ascending: false });
      if (filters?.status && filters.status !== "ALL") query = query.eq("status", filters.status);
      if (filters?.employeeId) query = query.eq("target_employee_id", filters.employeeId);
      const { data, error } = await query.limit(100);
      if (!error) setIncidents(data || []);
    } catch (err) {
      console.error("[audit] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.employeeId]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);
  return { incidents, loading, refresh: fetchIncidents };
}

export async function createIncidentReport(data: {
  target_employee_id: string;
  target_employee_name: string;
  incident_type: string;
  severity: string;
  title: string;
  description: string;
  evidence_type?: string;
  evidence_url?: string;
  evidence_notes?: string;
  room_number?: string;
  amount_involved?: number;
  shift_session_id?: string;
  operation_flow_id?: string;
}): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: emp } = await supabase.from("employees").select("id, first_name, last_name").eq("auth_user_id", user.id).single();
    if (!emp) return false;

    const { error } = await supabase.from("incident_reports").insert({
      reported_by: emp.id,
      reported_by_name: `${emp.first_name} ${emp.last_name}`,
      ...data,
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[audit] Error creating incident:", err);
    return false;
  }
}

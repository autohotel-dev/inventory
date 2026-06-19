// Types for the granular performance analytics dashboard v2
// All data comes from real SQL RPCs - no fabricated values

export interface CocheroKPIv2 {
  employee_id: string;
  employee_name: string;
  total_checkins: number;
  avg_checkin_time_minutes: number;
  min_checkin_time_minutes: number;
  max_checkin_time_minutes: number;
  stddev_checkin_minutes: number;
  total_checkouts: number;
  avg_checkout_time_minutes: number;
  min_checkout_time_minutes: number;
  max_checkout_time_minutes: number;
  stddev_checkout_minutes: number;
  total_services: number;
  checkins_under_sla: number;
  checkouts_under_sla: number;
  sla_compliance_pct: number;
  performance_score: number;
  is_active: boolean;
}

export interface ReceptionistKPIv2 {
  employee_id: string;
  employee_name: string;
  total_entries_processed: number;
  avg_checkin_processing_minutes: number;
  min_checkin_processing_minutes: number;
  max_checkin_processing_minutes: number;
  total_exits_processed: number;
  avg_checkout_processing_minutes: number;
  min_checkout_processing_minutes: number;
  max_checkout_processing_minutes: number;
  total_extras_charged: number;
  total_revenue: number;
  revenue_per_stay: number;
  total_renewals: number;
  entries_under_sla: number;
  exits_under_sla: number;
  sla_compliance_pct: number;
  performance_score: number;
  stddev_entry_minutes: number;
  stddev_exit_minutes: number;
  is_active: boolean;
}

export interface CamaristaKPIv2 {
  employee_id: string;
  employee_name: string;
  total_rooms_cleaned: number;
  avg_cleaning_time_minutes: number;
  min_cleaning_time_minutes: number;
  max_cleaning_time_minutes: number;
  stddev_cleaning_minutes: number;
  currently_cleaning: number;
  cleanings_under_sla: number;
  sla_compliance_pct: number;
  recleanings_count: number;
  performance_score: number;
  is_active: boolean;
}

export interface EmployeeRanking {
  employee_id: string;
  employee_name: string;
  employee_role: string;
  total_actions: number;
  avg_time_minutes: number;
  performance_score: number;
  department_rank: number;
  department_percentile: number;
  trend_pct: number;
  sla_compliance_pct: number;
  is_active: boolean;
}

// Granular action-level metrics for cocheros
export interface CocheroActionMetrics {
  employee_id: string;
  employee_name: string;
  // Entry metrics (Phase 2 - requires valet_claimed_at/valet_data_filled_at columns)
  avg_entry_acceptance_minutes: number;
  avg_entry_data_fill_minutes: number;
  total_entries_accepted: number;
  // Consumption/delivery metrics (Phase 1 - already tracked)
  total_deliveries_accepted: number;
  avg_delivery_acceptance_minutes: number;
  avg_delivery_execution_minutes: number;
  avg_payment_collection_minutes: number;
  total_deliveries_completed: number;
  // Delivery breakdown by type
  consumption_deliveries: number;
  extra_person_deliveries: number;
  extra_hour_deliveries: number;
  renewal_deliveries: number;
  // Checkout revision metrics (Phase 1 - already tracked)
  total_checkout_revisions: number;
  avg_checkout_revision_minutes: number;
  min_checkout_revision_minutes: number;
  max_checkout_revision_minutes: number;
  // TV/Room inspection metrics (Phase 3 - requires room_inspections table)
  total_inspections_assigned: number;
  total_inspections_completed: number;
  avg_inspection_acceptance_minutes: number;
  avg_inspection_completion_minutes: number;
  is_active: boolean;
}

// SLA targets in minutes per department
export const SLA_TARGETS = {
  cochero: { checkin: 5, checkout: 10, delivery_accept: 3, delivery_exec: 5, revision: 3, entry_accept: 2, data_fill: 3 },
  receptionist: { checkin: 3, checkout: 5 },
  camarista: { cleaning: 25 },
} as const;

// Score thresholds for visual display
export const SCORE_THRESHOLDS = {
  excellent: 85,
  good: 70,
  warning: 50,
  critical: 0,
} as const;

export function getScoreColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.excellent) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= SCORE_THRESHOLDS.good) return 'text-blue-600 dark:text-blue-400';
  if (score >= SCORE_THRESHOLDS.warning) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function getScoreBgColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.excellent) return 'bg-emerald-500';
  if (score >= SCORE_THRESHOLDS.good) return 'bg-blue-500';
  if (score >= SCORE_THRESHOLDS.warning) return 'bg-amber-500';
  return 'bg-red-500';
}

export function getScoreLabel(score: number): string {
  if (score >= SCORE_THRESHOLDS.excellent) return 'Excelente';
  if (score >= SCORE_THRESHOLDS.good) return 'Bueno';
  if (score >= SCORE_THRESHOLDS.warning) return 'Regular';
  return 'Crítico';
}

export function getTrendIcon(trendPct: number): { icon: 'up' | 'down' | 'stable'; color: string } {
  if (trendPct > 3) return { icon: 'up', color: 'text-emerald-500' };
  if (trendPct < -3) return { icon: 'down', color: 'text-red-500' };
  return { icon: 'stable', color: 'text-muted-foreground' };
}

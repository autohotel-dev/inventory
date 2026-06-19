-- ==============================================================================
-- MIGRATION: Receptionist Granular Action Metrics
-- Description:
--   New RPC get_receptionist_action_metrics() returning per-receptionist timing
--   for payment confirmation, checkout processing, consumption creation,
--   inspection assignment, revenue & volume metrics.
-- ==============================================================================

DROP FUNCTION IF EXISTS get_receptionist_action_metrics(DATE, DATE);

CREATE OR REPLACE FUNCTION get_receptionist_action_metrics(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  employee_id                        UUID,
  employee_name                      TEXT,

  -- Timing: Payment Confirmation
  total_payments_confirmed           INTEGER,
  avg_entry_confirmation_minutes     DECIMAL,
  avg_extra_confirmation_minutes     DECIMAL,

  -- Timing: Checkout Processing
  total_checkouts_processed          INTEGER,
  avg_checkout_processing_minutes    DECIMAL,

  -- Timing: Consumption Creation
  total_consumptions_created         INTEGER,
  avg_consumption_to_delivery_minutes DECIMAL,

  -- Timing: Inspection Assignment
  total_inspections_assigned         INTEGER,
  avg_inspection_turnaround_minutes  DECIMAL,

  -- Revenue & Volume
  total_revenue_confirmed            DECIMAL,
  entry_confirmations                INTEGER,
  extra_confirmations                INTEGER,

  -- Status
  is_active                          BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS employee_id,
    (e.first_name || ' ' || e.last_name)::TEXT AS employee_name,

    -- ═══════════════════════════════════════════════════════
    -- PAYMENT CONFIRMATION METRICS (from payments)
    -- ═══════════════════════════════════════════════════════
    COALESCE(pay_conf.cnt_total, 0)::INTEGER          AS total_payments_confirmed,
    COALESCE(pay_conf.avg_entry_min, 0)::DECIMAL      AS avg_entry_confirmation_minutes,
    COALESCE(pay_conf.avg_extra_min, 0)::DECIMAL      AS avg_extra_confirmation_minutes,

    -- ═══════════════════════════════════════════════════════
    -- CHECKOUT PROCESSING METRICS (from room_stays)
    -- ═══════════════════════════════════════════════════════
    COALESCE(co_stays.cnt_checkouts, 0)::INTEGER      AS total_checkouts_processed,
    COALESCE(co_stays.avg_checkout_min, 0)::DECIMAL   AS avg_checkout_processing_minutes,

    -- ═══════════════════════════════════════════════════════
    -- CONSUMPTION CREATION METRICS (from sales_order_items)
    -- ═══════════════════════════════════════════════════════
    COALESCE(cons_items.cnt_created, 0)::INTEGER      AS total_consumptions_created,
    COALESCE(cons_items.avg_delivery_min, 0)::DECIMAL AS avg_consumption_to_delivery_minutes,

    -- ═══════════════════════════════════════════════════════
    -- INSPECTION ASSIGNMENT METRICS (from room_inspections)
    -- ═══════════════════════════════════════════════════════
    COALESCE(insp_asgn.cnt_assigned, 0)::INTEGER      AS total_inspections_assigned,
    COALESCE(insp_asgn.avg_turnaround, 0)::DECIMAL   AS avg_inspection_turnaround_minutes,

    -- ═══════════════════════════════════════════════════════
    -- REVENUE & VOLUME
    -- ═══════════════════════════════════════════════════════
    COALESCE(rev_vol.total_revenue, 0)::DECIMAL       AS total_revenue_confirmed,
    COALESCE(rev_vol.entry_cnt, 0)::INTEGER           AS entry_confirmations,
    COALESCE(rev_vol.extra_cnt, 0)::INTEGER           AS extra_confirmations,

    -- Status
    (e.deleted_at IS NULL) AS is_active

  FROM employees e
  LEFT JOIN roles rl ON rl.id = e.role_id

  -- ─────────────────────────────────────────────────────────
  -- LATERAL 1: Payment confirmation timing
  -- ─────────────────────────────────────────────────────────
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS cnt_total,

      -- AVG of (confirmed_at - collected_at) for ESTANCIA, filter > 0 AND <= 60 min
      ROUND(AVG(
        EXTRACT(EPOCH FROM (pc.confirmed_at - pc.collected_at)) / 60.0
      ) FILTER (
        WHERE pc.concept = 'ESTANCIA'
          AND pc.collected_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (pc.confirmed_at - pc.collected_at)) / 60.0 > 0
          AND EXTRACT(EPOCH FROM (pc.confirmed_at - pc.collected_at)) / 60.0 <= 60
      )::NUMERIC, 2) AS avg_entry_min,

      -- AVG of (confirmed_at - collected_at) for extras, filter > 0 AND <= 60 min
      ROUND(AVG(
        EXTRACT(EPOCH FROM (pc.confirmed_at - pc.collected_at)) / 60.0
      ) FILTER (
        WHERE pc.concept IN ('CONSUMPTION', 'PERSONA_EXTRA', 'HORA_EXTRA', 'RENOVACION')
          AND pc.collected_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (pc.confirmed_at - pc.collected_at)) / 60.0 > 0
          AND EXTRACT(EPOCH FROM (pc.confirmed_at - pc.collected_at)) / 60.0 <= 60
      )::NUMERIC, 2) AS avg_extra_min

    FROM payments pc
    WHERE pc.confirmed_by = e.id
      AND pc.confirmed_at IS NOT NULL
      AND DATE(pc.confirmed_at) BETWEEN p_start_date AND p_end_date
  ) pay_conf ON TRUE

  -- ─────────────────────────────────────────────────────────
  -- LATERAL 2: Checkout processing timing
  -- ─────────────────────────────────────────────────────────
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS cnt_checkouts,

      -- AVG of (actual_check_out_at - vehicle_requested_at), filter > 0 AND <= 60 min
      ROUND(AVG(checkout_mins) FILTER (
        WHERE checkout_mins > 0 AND checkout_mins <= 60
      )::NUMERIC, 2) AS avg_checkout_min
    FROM (
      SELECT
        EXTRACT(EPOCH FROM (co_rs.actual_check_out_at - co_rs.vehicle_requested_at)) / 60.0 AS checkout_mins
      FROM room_stays co_rs
      JOIN shift_sessions co_ss ON co_rs.checkout_shift_session_id = co_ss.id
      WHERE co_ss.employee_id = e.id
        AND co_rs.actual_check_out_at IS NOT NULL
        AND co_rs.vehicle_requested_at IS NOT NULL
        AND DATE(co_rs.actual_check_out_at) BETWEEN p_start_date AND p_end_date
    ) co_sub
  ) co_stays ON TRUE

  -- ─────────────────────────────────────────────────────────
  -- LATERAL 3: Consumption creation & delivery pipeline timing
  -- ─────────────────────────────────────────────────────────
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS cnt_created,

      -- AVG of (delivery_completed_at - created_at) for delivered items, filter > 0 AND <= 120 min
      ROUND(AVG(
        EXTRACT(EPOCH FROM (ci.delivery_completed_at - ci.created_at)) / 60.0
      ) FILTER (
        WHERE ci.delivery_completed_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (ci.delivery_completed_at - ci.created_at)) / 60.0 > 0
          AND EXTRACT(EPOCH FROM (ci.delivery_completed_at - ci.created_at)) / 60.0 <= 120
      )::NUMERIC, 2) AS avg_delivery_min

    FROM sales_order_items ci
    JOIN shift_sessions ci_ss ON ci.shift_session_id = ci_ss.id
    WHERE ci_ss.employee_id = e.id
      AND ci.concept_type = 'CONSUMPTION'
      AND DATE(ci.created_at) BETWEEN p_start_date AND p_end_date
  ) cons_items ON TRUE

  -- ─────────────────────────────────────────────────────────
  -- LATERAL 4: Inspection assignment & turnaround timing
  -- ─────────────────────────────────────────────────────────
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS cnt_assigned,

      -- AVG of (completed_at - assigned_at), filter > 0 AND <= 120 min
      ROUND(AVG(
        EXTRACT(EPOCH FROM (ri.completed_at - ri.assigned_at)) / 60.0
      ) FILTER (
        WHERE ri.completed_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (ri.completed_at - ri.assigned_at)) / 60.0 > 0
          AND EXTRACT(EPOCH FROM (ri.completed_at - ri.assigned_at)) / 60.0 <= 120
      )::NUMERIC, 2) AS avg_turnaround

    FROM room_inspections ri
    WHERE ri.assigned_by = e.id
      AND DATE(ri.assigned_at) BETWEEN p_start_date AND p_end_date
  ) insp_asgn ON TRUE

  -- ─────────────────────────────────────────────────────────
  -- LATERAL 5: Revenue & volume breakdown
  -- ─────────────────────────────────────────────────────────
  LEFT JOIN LATERAL (
    SELECT
      -- Total revenue from confirmed payments
      SUM(rv.amount) FILTER (
        WHERE rv.status = 'PAGADO'
      ) AS total_revenue,

      -- Count of ESTANCIA confirmations
      COUNT(*) FILTER (
        WHERE rv.concept = 'ESTANCIA'
      )::INTEGER AS entry_cnt,

      -- Count of extras confirmations
      COUNT(*) FILTER (
        WHERE rv.concept IN ('CONSUMPTION', 'PERSONA_EXTRA', 'HORA_EXTRA', 'RENOVACION')
      )::INTEGER AS extra_cnt

    FROM payments rv
    WHERE rv.confirmed_by = e.id
      AND rv.confirmed_at IS NOT NULL
      AND DATE(rv.confirmed_at) BETWEEN p_start_date AND p_end_date
  ) rev_vol ON TRUE

  -- Only receptionist employees
  WHERE LOWER(e.role) IN ('receptionist', 'recepcionista')
     OR LOWER(rl.name) IN ('receptionist', 'recepcionista');

END;
$$;

COMMENT ON FUNCTION get_receptionist_action_metrics(DATE, DATE) IS
  'Returns per-receptionist granular timing for payment confirmation (entry + extras), checkout processing, consumption creation pipeline, inspection turnaround, plus revenue and volume breakdown. Used by the management dashboard for detailed receptionist performance analysis.';


-- ═══════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '✓ Created get_receptionist_action_metrics(DATE, DATE) RPC';
END $$;

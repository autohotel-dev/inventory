-- ==============================================================================
-- MIGRATION: Granular Performance V2
-- Description:
--   Complete rewrite of all employee performance functions with:
--   1. get_cochero_performance_v2     – Full valet KPIs with SLA & scoring
--   2. get_receptionist_performance_v2 – Full reception KPIs with revenue & scoring
--   3. get_camarista_performance_v2    – Full cleaning KPIs with recleanings & scoring
--   4. get_employee_ranking            – Unified ranking across all roles with trends
--   5. get_active_sla_violations       – Fixed SLA violations (corrected CHECK_IN calc)
--
-- Performance Score formula (shared):
--   Score = (0.4 × speed) + (0.3 × volume) + (0.3 × consistency)
--   Speed     = GREATEST(0, LEAST(100, 100 - ((avg_time / sla_target) - 1) * 100))
--   Volume    = LEAST(100, (employee_count / avg_team_count) * 100)
--   Consistency = GREATEST(0, 100 - (stddev / NULLIF(avg, 0)) * 100)
--
-- SLA defaults:
--   Cochero check-in: 5 min | Cochero check-out: 10 min
--   Receptionist entry: 3 min | Receptionist exit: 5 min
--   Camarista cleaning: 25 min
-- ==============================================================================

-- ============================================================
-- 1. COCHERO PERFORMANCE V2
-- ============================================================
DROP FUNCTION IF EXISTS get_cochero_performance_v2(DATE, DATE);

CREATE OR REPLACE FUNCTION get_cochero_performance_v2(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  total_checkins INTEGER,
  avg_checkin_time_minutes DECIMAL,
  min_checkin_time_minutes DECIMAL,
  max_checkin_time_minutes DECIMAL,
  stddev_checkin_minutes DECIMAL,
  total_checkouts INTEGER,
  avg_checkout_time_minutes DECIMAL,
  min_checkout_time_minutes DECIMAL,
  max_checkout_time_minutes DECIMAL,
  stddev_checkout_minutes DECIMAL,
  total_services INTEGER,
  checkins_under_sla INTEGER,
  checkouts_under_sla INTEGER,
  sla_compliance_pct DECIMAL,
  performance_score DECIMAL,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg_team_volume DECIMAL;
BEGIN
  -- Pre-calculate the average team volume across all cocheros for the volume score.
  -- Uses SEPARATE counts for checkins and checkouts to avoid double-counting.
  SELECT AVG(sub.total_actions)::DECIMAL INTO v_avg_team_volume
  FROM (
    SELECT
      e.id,
      (
        (SELECT COUNT(*)::INTEGER
         FROM room_stays rs
         WHERE rs.valet_employee_id = e.id
           AND rs.check_in_at IS NOT NULL
           AND DATE(rs.check_in_at) BETWEEN p_start_date AND p_end_date)
        +
        (SELECT COUNT(*)::INTEGER
         FROM room_stays rs
         WHERE rs.checkout_valet_employee_id = e.id
           AND rs.actual_check_out_at IS NOT NULL
           AND DATE(rs.actual_check_out_at) BETWEEN p_start_date AND p_end_date)
      ) AS total_actions
    FROM employees e
    LEFT JOIN roles rl ON rl.id = e.role_id
    WHERE LOWER(e.role) IN ('valet', 'cochero') OR LOWER(rl.name) IN ('valet', 'cochero')
  ) sub
  WHERE sub.total_actions > 0;

  RETURN QUERY
  SELECT
    e.id AS employee_id,
    (e.first_name || ' ' || e.last_name)::TEXT AS employee_name,

    -- === CHECK-IN METRICS (valet_employee_id) ===
    COALESCE(ci.cnt, 0)::INTEGER AS total_checkins,
    COALESCE(ci.avg_min, 0)::DECIMAL AS avg_checkin_time_minutes,
    COALESCE(ci.min_min, 0)::DECIMAL AS min_checkin_time_minutes,
    COALESCE(ci.max_min, 0)::DECIMAL AS max_checkin_time_minutes,
    COALESCE(ci.std_min, 0)::DECIMAL AS stddev_checkin_minutes,

    -- === CHECK-OUT METRICS (checkout_valet_employee_id) ===
    COALESCE(co.cnt, 0)::INTEGER AS total_checkouts,
    COALESCE(co.avg_min, 0)::DECIMAL AS avg_checkout_time_minutes,
    COALESCE(co.min_min, 0)::DECIMAL AS min_checkout_time_minutes,
    COALESCE(co.max_min, 0)::DECIMAL AS max_checkout_time_minutes,
    COALESCE(co.std_min, 0)::DECIMAL AS stddev_checkout_minutes,

    -- === SERVICES (extra_hour, extra_person) ===
    COALESCE(
      (SELECT COUNT(*)::INTEGER
       FROM employee_movements em
       WHERE em.employee_id = e.id
         AND em.movement_type IN ('extra_hour', 'extra_person')
         AND DATE(em.created_at) BETWEEN p_start_date AND p_end_date),
    0)::INTEGER AS total_services,

    -- === SLA COUNTS ===
    COALESCE(ci.under_sla, 0)::INTEGER AS checkins_under_sla,
    COALESCE(co.under_sla, 0)::INTEGER AS checkouts_under_sla,

    -- === SLA COMPLIANCE % ===
    CASE
      WHEN COALESCE(ci.cnt, 0) + COALESCE(co.cnt, 0) = 0 THEN 0::DECIMAL
      ELSE ROUND(
        (COALESCE(ci.under_sla, 0) + COALESCE(co.under_sla, 0))::DECIMAL * 100.0
        / (COALESCE(ci.cnt, 0) + COALESCE(co.cnt, 0))::DECIMAL,
      2)
    END AS sla_compliance_pct,

    -- === PERFORMANCE SCORE ===
    ROUND(
      (
        -- Speed component (40%): average of checkin_speed and checkout_speed
        0.4 * (
          (
            GREATEST(0, LEAST(100, 100.0 - ((COALESCE(ci.avg_min, 0)::DECIMAL / 5.0) - 1.0) * 100.0))
            +
            GREATEST(0, LEAST(100, 100.0 - ((COALESCE(co.avg_min, 0)::DECIMAL / 10.0) - 1.0) * 100.0))
          ) / 2.0
        )
        -- Volume component (30%)
        + 0.3 * LEAST(100,
            (COALESCE(ci.cnt, 0) + COALESCE(co.cnt, 0))::DECIMAL * 100.0
            / NULLIF(v_avg_team_volume, 0)
          )
        -- Consistency component (30%): based on checkin stddev
        + 0.3 * GREATEST(0,
            100.0 - COALESCE(ci.std_min::DECIMAL / NULLIF(ci.avg_min, 0)::DECIMAL, 0) * 100.0
          )
      )::DECIMAL,
    2) AS performance_score,

    (e.deleted_at IS NULL) AS is_active

  FROM employees e
  LEFT JOIN roles rl ON rl.id = e.role_id

  -- Separate subquery for CHECK-INS to avoid double-counting
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS cnt,
      ROUND(AVG(mins)::NUMERIC, 2) AS avg_min,
      ROUND(MIN(mins)::NUMERIC, 2) AS min_min,
      ROUND(MAX(mins)::NUMERIC, 2) AS max_min,
      ROUND(COALESCE(STDDEV(mins), 0)::NUMERIC, 2) AS std_min,
      COUNT(*) FILTER (WHERE mins <= 5.0)::INTEGER AS under_sla
    FROM (
      SELECT EXTRACT(EPOCH FROM (rs.check_in_at - rs.created_at)) / 60.0 AS mins
      FROM room_stays rs
      WHERE rs.valet_employee_id = e.id
        AND rs.check_in_at IS NOT NULL
        AND DATE(rs.check_in_at) BETWEEN p_start_date AND p_end_date
        AND EXTRACT(EPOCH FROM (rs.check_in_at - rs.created_at)) / 60.0 > 0
        AND EXTRACT(EPOCH FROM (rs.check_in_at - rs.created_at)) / 60.0 <= 60
    ) t
  ) ci ON TRUE

  -- Separate subquery for CHECK-OUTS to avoid double-counting
  -- Uses ONLY valet_checkout_requested_at (when valet is assigned), NOT vehicle_requested_at
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS cnt,
      ROUND(AVG(mins)::NUMERIC, 2) AS avg_min,
      ROUND(MIN(mins)::NUMERIC, 2) AS min_min,
      ROUND(MAX(mins)::NUMERIC, 2) AS max_min,
      ROUND(COALESCE(STDDEV(mins), 0)::NUMERIC, 2) AS std_min,
      COUNT(*) FILTER (WHERE mins <= 10.0)::INTEGER AS under_sla
    FROM (
      SELECT EXTRACT(EPOCH FROM (rs.actual_check_out_at - rs.valet_checkout_requested_at)) / 60.0 AS mins
      FROM room_stays rs
      WHERE rs.checkout_valet_employee_id = e.id
        AND rs.actual_check_out_at IS NOT NULL
        AND rs.valet_checkout_requested_at IS NOT NULL
        AND DATE(rs.actual_check_out_at) BETWEEN p_start_date AND p_end_date
        AND EXTRACT(EPOCH FROM (rs.actual_check_out_at - rs.valet_checkout_requested_at)) / 60.0 > 0
        AND EXTRACT(EPOCH FROM (rs.actual_check_out_at - rs.valet_checkout_requested_at)) / 60.0 <= 60
    ) t
  ) co ON TRUE

  WHERE LOWER(e.role) IN ('valet', 'cochero') OR LOWER(rl.name) IN ('valet', 'cochero');
END;
$$;


-- ============================================================
-- 2. RECEPTIONIST PERFORMANCE V2
-- ============================================================
DROP FUNCTION IF EXISTS get_receptionist_performance_v2(DATE, DATE);

CREATE OR REPLACE FUNCTION get_receptionist_performance_v2(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  total_entries_processed INTEGER,
  avg_checkin_processing_minutes DECIMAL,
  min_checkin_processing_minutes DECIMAL,
  max_checkin_processing_minutes DECIMAL,
  total_exits_processed INTEGER,
  avg_checkout_processing_minutes DECIMAL,
  min_checkout_processing_minutes DECIMAL,
  max_checkout_processing_minutes DECIMAL,
  total_extras_charged INTEGER,
  total_revenue DECIMAL,
  revenue_per_stay DECIMAL,
  total_renewals INTEGER,
  entries_under_sla INTEGER,
  exits_under_sla INTEGER,
  sla_compliance_pct DECIMAL,
  performance_score DECIMAL,
  stddev_entry_minutes DECIMAL,
  stddev_exit_minutes DECIMAL,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg_team_volume DECIMAL;
BEGIN
  -- Pre-calculate average team volume for receptionists
  SELECT AVG(sub.total_actions)::DECIMAL INTO v_avg_team_volume
  FROM (
    SELECT
      e.id,
      (
        (SELECT COUNT(*)::INTEGER
         FROM room_stays rs
         JOIN shift_sessions ss ON rs.shift_session_id = ss.id
         WHERE ss.employee_id = e.id
           AND rs.check_in_at IS NOT NULL
           AND DATE(rs.check_in_at) BETWEEN p_start_date AND p_end_date)
        +
        (SELECT COUNT(*)::INTEGER
         FROM room_stays rs
         JOIN shift_sessions ss ON rs.checkout_shift_session_id = ss.id
         WHERE ss.employee_id = e.id
           AND rs.actual_check_out_at IS NOT NULL
           AND DATE(rs.actual_check_out_at) BETWEEN p_start_date AND p_end_date)
      ) AS total_actions
    FROM employees e
    LEFT JOIN roles rl ON rl.id = e.role_id
    WHERE LOWER(e.role) IN ('receptionist', 'recepcionista') OR LOWER(rl.name) IN ('receptionist', 'recepcionista')
  ) sub
  WHERE sub.total_actions > 0;

  RETURN QUERY
  SELECT
    e.id AS employee_id,
    (e.first_name || ' ' || e.last_name)::TEXT AS employee_name,

    -- === ENTRY METRICS (via shift_session_id) ===
    COALESCE(ent.cnt, 0)::INTEGER AS total_entries_processed,
    COALESCE(ent.avg_min, 0)::DECIMAL AS avg_checkin_processing_minutes,
    COALESCE(ent.min_min, 0)::DECIMAL AS min_checkin_processing_minutes,
    COALESCE(ent.max_min, 0)::DECIMAL AS max_checkin_processing_minutes,

    -- === EXIT METRICS (via checkout_shift_session_id) ===
    COALESCE(ext.cnt, 0)::INTEGER AS total_exits_processed,
    COALESCE(ext.avg_min, 0)::DECIMAL AS avg_checkout_processing_minutes,
    COALESCE(ext.min_min, 0)::DECIMAL AS min_checkout_processing_minutes,
    COALESCE(ext.max_min, 0)::DECIMAL AS max_checkout_processing_minutes,

    -- === EXTRAS CHARGED ===
    COALESCE(
      (SELECT COUNT(p.id)::INTEGER
       FROM payments p
       WHERE p.collected_by = e.id
         AND p.concept IN ('EXTRA_HOUR', 'PERSONA_EXTRA', 'RENEWAL', 'DAMAGE_CHARGE')
         AND p.status = 'PAGADO'
         AND DATE(p.created_at) BETWEEN p_start_date AND p_end_date),
    0)::INTEGER AS total_extras_charged,

    -- === TOTAL REVENUE ===
    COALESCE(
      (SELECT SUM(p.amount)::DECIMAL
       FROM payments p
       WHERE p.collected_by = e.id
         AND p.status = 'PAGADO'
         AND DATE(p.created_at) BETWEEN p_start_date AND p_end_date),
    0)::DECIMAL AS total_revenue,

    -- === REVENUE PER STAY ===
    ROUND(
      COALESCE(
        (SELECT SUM(p.amount)::DECIMAL
         FROM payments p
         WHERE p.collected_by = e.id
           AND p.status = 'PAGADO'
           AND DATE(p.created_at) BETWEEN p_start_date AND p_end_date),
      0)::DECIMAL
      / NULLIF(COALESCE(ent.cnt, 0) + COALESCE(ext.cnt, 0), 0)::DECIMAL,
    2) AS revenue_per_stay,

    -- === RENEWALS ===
    COALESCE(
      (SELECT COUNT(p.id)::INTEGER
       FROM payments p
       WHERE p.collected_by = e.id
         AND p.concept = 'RENEWAL'
         AND p.status = 'PAGADO'
         AND DATE(p.created_at) BETWEEN p_start_date AND p_end_date),
    0)::INTEGER AS total_renewals,

    -- === SLA COUNTS ===
    COALESCE(ent.under_sla, 0)::INTEGER AS entries_under_sla,
    COALESCE(ext.under_sla, 0)::INTEGER AS exits_under_sla,

    -- === SLA COMPLIANCE % ===
    CASE
      WHEN COALESCE(ent.cnt, 0) + COALESCE(ext.cnt, 0) = 0 THEN 0::DECIMAL
      ELSE ROUND(
        (COALESCE(ent.under_sla, 0) + COALESCE(ext.under_sla, 0))::DECIMAL * 100.0
        / (COALESCE(ent.cnt, 0) + COALESCE(ext.cnt, 0))::DECIMAL,
      2)
    END AS sla_compliance_pct,

    -- === PERFORMANCE SCORE ===
    ROUND(
      (
        -- Speed (40%): avg of entry speed and exit speed
        0.4 * (
          (
            GREATEST(0, LEAST(100, 100.0 - ((COALESCE(ent.avg_min, 0)::DECIMAL / 3.0) - 1.0) * 100.0))
            +
            GREATEST(0, LEAST(100, 100.0 - ((COALESCE(ext.avg_min, 0)::DECIMAL / 5.0) - 1.0) * 100.0))
          ) / 2.0
        )
        -- Volume (30%)
        + 0.3 * LEAST(100,
            (COALESCE(ent.cnt, 0) + COALESCE(ext.cnt, 0))::DECIMAL * 100.0
            / NULLIF(v_avg_team_volume, 0)
          )
        -- Consistency (30%): based on entry stddev
        + 0.3 * GREATEST(0,
            100.0 - COALESCE(ent.std_min::DECIMAL / NULLIF(ent.avg_min, 0)::DECIMAL, 0) * 100.0
          )
      )::DECIMAL,
    2) AS performance_score,

    -- === STDDEV ===
    COALESCE(ent.std_min, 0)::DECIMAL AS stddev_entry_minutes,
    COALESCE(ext.std_min, 0)::DECIMAL AS stddev_exit_minutes,

    (e.deleted_at IS NULL) AS is_active

  FROM employees e
  LEFT JOIN roles rl ON rl.id = e.role_id

  -- Entries: room_stays linked via shift_session_id → shift_sessions.employee_id
  -- Processing time = check_in_at - created_at (time from stay creation to guest checked in)
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS cnt,
      ROUND(AVG(mins)::NUMERIC, 2) AS avg_min,
      ROUND(MIN(mins)::NUMERIC, 2) AS min_min,
      ROUND(MAX(mins)::NUMERIC, 2) AS max_min,
      ROUND(COALESCE(STDDEV(mins), 0)::NUMERIC, 2) AS std_min,
      COUNT(*) FILTER (WHERE mins <= 3.0)::INTEGER AS under_sla
    FROM (
      SELECT EXTRACT(EPOCH FROM (rs.check_in_at - rs.created_at)) / 60.0 AS mins
      FROM room_stays rs
      JOIN shift_sessions ss ON rs.shift_session_id = ss.id
      WHERE ss.employee_id = e.id
        AND rs.check_in_at IS NOT NULL
        AND DATE(rs.check_in_at) BETWEEN p_start_date AND p_end_date
        AND EXTRACT(EPOCH FROM (rs.check_in_at - rs.created_at)) / 60.0 > 0
        AND EXTRACT(EPOCH FROM (rs.check_in_at - rs.created_at)) / 60.0 <= 60
    ) t
  ) ent ON TRUE

  -- Exits: room_stays linked via checkout_shift_session_id → shift_sessions.employee_id
  -- Processing time = actual_check_out_at - vehicle_requested_at (reception requested checkout)
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS cnt,
      ROUND(AVG(mins)::NUMERIC, 2) AS avg_min,
      ROUND(MIN(mins)::NUMERIC, 2) AS min_min,
      ROUND(MAX(mins)::NUMERIC, 2) AS max_min,
      ROUND(COALESCE(STDDEV(mins), 0)::NUMERIC, 2) AS std_min,
      COUNT(*) FILTER (WHERE mins <= 5.0)::INTEGER AS under_sla
    FROM (
      SELECT EXTRACT(EPOCH FROM (rs.actual_check_out_at - rs.vehicle_requested_at)) / 60.0 AS mins
      FROM room_stays rs
      JOIN shift_sessions ss ON rs.checkout_shift_session_id = ss.id
      WHERE ss.employee_id = e.id
        AND rs.actual_check_out_at IS NOT NULL
        AND rs.vehicle_requested_at IS NOT NULL
        AND DATE(rs.actual_check_out_at) BETWEEN p_start_date AND p_end_date
        AND EXTRACT(EPOCH FROM (rs.actual_check_out_at - rs.vehicle_requested_at)) / 60.0 > 0
        AND EXTRACT(EPOCH FROM (rs.actual_check_out_at - rs.vehicle_requested_at)) / 60.0 <= 60
    ) t
  ) ext ON TRUE

  WHERE LOWER(e.role) IN ('receptionist', 'recepcionista') OR LOWER(rl.name) IN ('receptionist', 'recepcionista');
END;
$$;


-- ============================================================
-- 3. CAMARISTA PERFORMANCE V2
-- ============================================================
DROP FUNCTION IF EXISTS get_camarista_performance_v2(DATE, DATE);

CREATE OR REPLACE FUNCTION get_camarista_performance_v2(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  total_rooms_cleaned INTEGER,
  avg_cleaning_time_minutes DECIMAL,
  min_cleaning_time_minutes DECIMAL,
  max_cleaning_time_minutes DECIMAL,
  stddev_cleaning_minutes DECIMAL,
  currently_cleaning INTEGER,
  cleanings_under_sla INTEGER,
  sla_compliance_pct DECIMAL,
  recleanings_count INTEGER,
  performance_score DECIMAL,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_avg_team_volume DECIMAL;
BEGIN
  -- Pre-calculate average team cleaning volume
  SELECT AVG(sub.total_cleaned)::DECIMAL INTO v_avg_team_volume
  FROM (
    SELECT
      e.id,
      (SELECT COUNT(*)::INTEGER
       FROM room_cleanings rc
       WHERE rc.employee_id = e.id
         AND rc.ended_at IS NOT NULL
         AND DATE(rc.ended_at) BETWEEN p_start_date AND p_end_date) AS total_cleaned
    FROM employees e
    LEFT JOIN roles rl ON rl.id = e.role_id
    WHERE LOWER(e.role) IN ('camarista', 'recamarista') OR LOWER(rl.name) IN ('camarista', 'recamarista')
  ) sub
  WHERE sub.total_cleaned > 0;

  RETURN QUERY
  SELECT
    e.id AS employee_id,
    (e.first_name || ' ' || e.last_name)::TEXT AS employee_name,

    -- === CLEANING METRICS ===
    COALESCE(cl.cnt, 0)::INTEGER AS total_rooms_cleaned,
    COALESCE(cl.avg_min, 0)::DECIMAL AS avg_cleaning_time_minutes,
    COALESCE(cl.min_min, 0)::DECIMAL AS min_cleaning_time_minutes,
    COALESCE(cl.max_min, 0)::DECIMAL AS max_cleaning_time_minutes,
    COALESCE(cl.std_min, 0)::DECIMAL AS stddev_cleaning_minutes,

    -- === CURRENTLY CLEANING ===
    (SELECT COUNT(r.id)::INTEGER
     FROM rooms r
     WHERE r.status = 'LIMPIANDO'
       AND r.cleaning_by_employee_id = e.id)::INTEGER AS currently_cleaning,

    -- === SLA ===
    COALESCE(cl.under_sla, 0)::INTEGER AS cleanings_under_sla,

    CASE
      WHEN COALESCE(cl.cnt, 0) = 0 THEN 0::DECIMAL
      ELSE ROUND(
        COALESCE(cl.under_sla, 0)::DECIMAL * 100.0 / cl.cnt::DECIMAL,
      2)
    END AS sla_compliance_pct,

    -- === RECLEANINGS (same room cleaned again within 2 hours → quality issue) ===
    COALESCE(
      (SELECT COUNT(*)::INTEGER
       FROM room_cleanings rc1
       WHERE rc1.employee_id = e.id
         AND rc1.ended_at IS NOT NULL
         AND DATE(rc1.ended_at) BETWEEN p_start_date AND p_end_date
         AND EXISTS (
           SELECT 1 FROM room_cleanings rc2
           WHERE rc2.room_id = rc1.room_id
             AND rc2.id != rc1.id
             AND rc2.started_at > rc1.ended_at
             AND rc2.started_at <= rc1.ended_at + INTERVAL '2 hours'
         )),
    0)::INTEGER AS recleanings_count,

    -- === PERFORMANCE SCORE ===
    ROUND(
      (
        -- Speed (40%)
        0.4 * GREATEST(0, LEAST(100, 100.0 - ((COALESCE(cl.avg_min, 0)::DECIMAL / 25.0) - 1.0) * 100.0))
        -- Volume (30%)
        + 0.3 * LEAST(100,
            COALESCE(cl.cnt, 0)::DECIMAL * 100.0
            / NULLIF(v_avg_team_volume, 0)
          )
        -- Consistency (30%)
        + 0.3 * GREATEST(0,
            100.0 - COALESCE(cl.std_min::DECIMAL / NULLIF(cl.avg_min, 0)::DECIMAL, 0) * 100.0
          )
      )::DECIMAL,
    2) AS performance_score,

    (e.deleted_at IS NULL) AS is_active

  FROM employees e
  LEFT JOIN roles rl ON rl.id = e.role_id

  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS cnt,
      ROUND(AVG(rc.duration_minutes)::NUMERIC, 2) AS avg_min,
      ROUND(MIN(rc.duration_minutes)::NUMERIC, 2) AS min_min,
      ROUND(MAX(rc.duration_minutes)::NUMERIC, 2) AS max_min,
      ROUND(COALESCE(STDDEV(rc.duration_minutes), 0)::NUMERIC, 2) AS std_min,
      COUNT(*) FILTER (WHERE rc.duration_minutes <= 25)::INTEGER AS under_sla
    FROM room_cleanings rc
    WHERE rc.employee_id = e.id
      AND rc.ended_at IS NOT NULL
      AND rc.duration_minutes > 0
      AND rc.duration_minutes <= 180
      AND DATE(rc.ended_at) BETWEEN p_start_date AND p_end_date
  ) cl ON TRUE

  WHERE LOWER(e.role) IN ('camarista', 'recamarista') OR LOWER(rl.name) IN ('camarista', 'recamarista');
END;
$$;


-- ============================================================
-- 4. EMPLOYEE RANKING (Unified cross-role ranking with trends)
-- ============================================================
DROP FUNCTION IF EXISTS get_employee_ranking(DATE, DATE);

CREATE OR REPLACE FUNCTION get_employee_ranking(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  employee_role TEXT,
  total_actions INTEGER,
  avg_time_minutes DECIMAL,
  performance_score DECIMAL,
  department_rank INTEGER,
  department_percentile DECIMAL,
  trend_pct DECIMAL,
  sla_compliance_pct DECIMAL,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_days INTEGER;
  v_prev_start DATE;
  v_prev_end DATE;
BEGIN
  -- Calculate previous period of same length for trend comparison
  v_period_days := (p_end_date - p_start_date) + 1;
  v_prev_end := p_start_date - 1;
  v_prev_start := v_prev_end - v_period_days + 1;

  RETURN QUERY

  WITH current_scores AS (
    -- Cocheros
    SELECT
      c.employee_id,
      c.employee_name,
      'cochero'::TEXT AS employee_role,
      (c.total_checkins + c.total_checkouts)::INTEGER AS total_actions,
      CASE
        WHEN c.total_checkins + c.total_checkouts = 0 THEN 0::DECIMAL
        ELSE ROUND(
          (c.avg_checkin_time_minutes * c.total_checkins + c.avg_checkout_time_minutes * c.total_checkouts)::DECIMAL
          / (c.total_checkins + c.total_checkouts)::DECIMAL,
        2)
      END AS avg_time_minutes,
      c.performance_score,
      c.sla_compliance_pct,
      c.is_active
    FROM get_cochero_performance_v2(p_start_date, p_end_date) c

    UNION ALL

    -- Receptionists
    SELECT
      r.employee_id,
      r.employee_name,
      'recepcionista'::TEXT AS employee_role,
      (r.total_entries_processed + r.total_exits_processed)::INTEGER AS total_actions,
      CASE
        WHEN r.total_entries_processed + r.total_exits_processed = 0 THEN 0::DECIMAL
        ELSE ROUND(
          (r.avg_checkin_processing_minutes * r.total_entries_processed + r.avg_checkout_processing_minutes * r.total_exits_processed)::DECIMAL
          / (r.total_entries_processed + r.total_exits_processed)::DECIMAL,
        2)
      END AS avg_time_minutes,
      r.performance_score,
      r.sla_compliance_pct,
      r.is_active
    FROM get_receptionist_performance_v2(p_start_date, p_end_date) r

    UNION ALL

    -- Camaristas
    SELECT
      ca.employee_id,
      ca.employee_name,
      'camarista'::TEXT AS employee_role,
      ca.total_rooms_cleaned::INTEGER AS total_actions,
      ca.avg_cleaning_time_minutes AS avg_time_minutes,
      ca.performance_score,
      ca.sla_compliance_pct,
      ca.is_active
    FROM get_camarista_performance_v2(p_start_date, p_end_date) ca
  ),

  previous_scores AS (
    -- Cocheros previous period
    SELECT
      c.employee_id,
      c.performance_score
    FROM get_cochero_performance_v2(v_prev_start, v_prev_end) c

    UNION ALL

    -- Receptionists previous period
    SELECT
      r.employee_id,
      r.performance_score
    FROM get_receptionist_performance_v2(v_prev_start, v_prev_end) r

    UNION ALL

    -- Camaristas previous period
    SELECT
      ca.employee_id,
      ca.performance_score
    FROM get_camarista_performance_v2(v_prev_start, v_prev_end) ca
  ),

  ranked AS (
    SELECT
      cs.*,
      ROW_NUMBER() OVER (PARTITION BY cs.employee_role ORDER BY cs.performance_score DESC)::INTEGER AS dept_rank,
      ROUND(
        PERCENT_RANK() OVER (PARTITION BY cs.employee_role ORDER BY cs.performance_score ASC)::NUMERIC * 100.0,
      2) AS dept_percentile,
      ps.performance_score AS prev_score
    FROM current_scores cs
    LEFT JOIN previous_scores ps ON ps.employee_id = cs.employee_id
  )

  SELECT
    ranked.employee_id,
    ranked.employee_name,
    ranked.employee_role,
    ranked.total_actions,
    ranked.avg_time_minutes,
    ranked.performance_score,
    ranked.dept_rank AS department_rank,
    ranked.dept_percentile AS department_percentile,
    -- Trend: % change vs previous period
    CASE
      WHEN ranked.prev_score IS NULL OR ranked.prev_score = 0 THEN NULL::DECIMAL
      ELSE ROUND(
        ((ranked.performance_score - ranked.prev_score)::DECIMAL / ranked.prev_score::DECIMAL) * 100.0,
      2)
    END AS trend_pct,
    ranked.sla_compliance_pct,
    ranked.is_active
  FROM ranked
  ORDER BY ranked.employee_role, ranked.dept_rank;
END;
$$;


-- ============================================================
-- 5. FIXED get_active_sla_violations()
-- ============================================================
DROP FUNCTION IF EXISTS get_active_sla_violations();

CREATE OR REPLACE FUNCTION get_active_sla_violations()
RETURNS TABLE (
  entity_id UUID,
  entity_type TEXT,
  description TEXT,
  employee_name TEXT,
  minutes_elapsed INTEGER,
  severity TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY

  -- 1. Cochero CHECK-IN SLA: >10 min since stay created (rs.created_at)
  --    FIXED: uses rs.created_at instead of COALESCE(rs.vehicle_requested_at, rs.created_at)
  --    because vehicle_requested_at is a checkout field, not relevant for check-in timing.
  SELECT
    rs.id AS entity_id,
    'CHECK_IN'::TEXT AS entity_type,
    'Demora en dar entrada a vehículo'::TEXT AS description,
    COALESCE(e.first_name || ' ' || e.last_name, 'Sin asignar')::TEXT AS employee_name,
    (EXTRACT(EPOCH FROM (NOW() - rs.created_at)) / 60.0)::INTEGER AS minutes_elapsed,
    CASE
      WHEN EXTRACT(EPOCH FROM (NOW() - rs.created_at)) / 60.0 > 20 THEN 'CRITICAL'::TEXT
      ELSE 'WARNING'::TEXT
    END AS severity
  FROM room_stays rs
  LEFT JOIN employees e ON e.id = rs.valet_employee_id
  WHERE (rs.status = 'PENDING_CHECK_IN'
         OR (rs.status = 'ACTIVA' AND rs.check_in_at IS NULL))
    AND rs.created_at < NOW() - INTERVAL '10 minutes'

  UNION ALL

  -- 2. Receptionist CHECK-IN processing SLA: >10 min to process check-in
  --    Flags active stays where (check_in_at - created_at) exceeds 10 minutes
  SELECT
    rs.id AS entity_id,
    'RECEPTIONIST_CHECK_IN'::TEXT AS entity_type,
    'Demora en procesamiento de entrada por recepción'::TEXT AS description,
    COALESCE(re.first_name || ' ' || re.last_name, 'Recepcionista sin asignar')::TEXT AS employee_name,
    (EXTRACT(EPOCH FROM (NOW() - rs.created_at)) / 60.0)::INTEGER AS minutes_elapsed,
    CASE
      WHEN EXTRACT(EPOCH FROM (NOW() - rs.created_at)) / 60.0 > 20 THEN 'CRITICAL'::TEXT
      ELSE 'WARNING'::TEXT
    END AS severity
  FROM room_stays rs
  LEFT JOIN shift_sessions ss ON rs.shift_session_id = ss.id
  LEFT JOIN employees re ON re.id = ss.employee_id
  WHERE rs.status = 'ACTIVA'
    AND rs.check_in_at IS NULL
    AND rs.created_at < NOW() - INTERVAL '10 minutes'
    AND rs.shift_session_id IS NOT NULL

  UNION ALL

  -- 3. Cochero CHECK-OUT SLA: >15 min since valet checkout requested
  SELECT
    rs.id AS entity_id,
    'CHECK_OUT'::TEXT AS entity_type,
    'Demora en entrega de vehículo'::TEXT AS description,
    COALESCE(e.first_name || ' ' || e.last_name, 'Sin asignar')::TEXT AS employee_name,
    (EXTRACT(EPOCH FROM (NOW() - rs.valet_checkout_requested_at)) / 60.0)::INTEGER AS minutes_elapsed,
    CASE
      WHEN EXTRACT(EPOCH FROM (NOW() - rs.valet_checkout_requested_at)) / 60.0 > 25 THEN 'CRITICAL'::TEXT
      ELSE 'WARNING'::TEXT
    END AS severity
  FROM room_stays rs
  LEFT JOIN employees e ON e.id = rs.checkout_valet_employee_id
  WHERE rs.valet_checkout_requested_at IS NOT NULL
    AND rs.actual_check_out_at IS NULL
    AND rs.valet_checkout_requested_at < NOW() - INTERVAL '15 minutes'

  UNION ALL

  -- 4. Camarista CLEANING SLA: >45 min since cleaning started
  SELECT
    r.id AS entity_id,
    'CLEANING'::TEXT AS entity_type,
    ('Habitación ' || r.number || ' demora en limpieza')::TEXT AS description,
    COALESCE(e.first_name || ' ' || e.last_name, 'Camarista sin asignar')::TEXT AS employee_name,
    (EXTRACT(EPOCH FROM (NOW() - r.cleaning_started_at)) / 60.0)::INTEGER AS minutes_elapsed,
    CASE
      WHEN EXTRACT(EPOCH FROM (NOW() - r.cleaning_started_at)) / 60.0 > 60 THEN 'CRITICAL'::TEXT
      ELSE 'WARNING'::TEXT
    END AS severity
  FROM rooms r
  LEFT JOIN employees e ON e.id = r.cleaning_by_employee_id
  WHERE r.status = 'LIMPIANDO'
    AND r.cleaning_started_at < NOW() - INTERVAL '45 minutes';

END;
$$;

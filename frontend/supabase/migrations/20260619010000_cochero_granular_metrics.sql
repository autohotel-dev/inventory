-- ==============================================================================
-- MIGRATION: Cochero Granular Action Metrics
-- Description:
--   Part 1 – New columns on room_stays for entry timing granularity
--   Part 2 – New table room_inspections for TV checks, damage checks, etc.
--   Part 3 – New RPC get_cochero_action_metrics() returning per-cochero timing
--            for entry acceptance, data fill, deliveries, checkout revisions,
--            and room inspections.
-- ==============================================================================


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 1: New columns on room_stays for entry timing                      ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- valet_claimed_at: When the cochero taps 'Accept Entry' on an incoming vehicle
ALTER TABLE public.room_stays
ADD COLUMN IF NOT EXISTS valet_claimed_at TIMESTAMPTZ DEFAULT NULL;

-- valet_data_filled_at: When the cochero finishes filling vehicle data (plates, color, etc.)
ALTER TABLE public.room_stays
ADD COLUMN IF NOT EXISTS valet_data_filled_at TIMESTAMPTZ DEFAULT NULL;

-- Partial indexes – only index rows that have a value
CREATE INDEX IF NOT EXISTS idx_room_stays_valet_claimed_at
  ON public.room_stays (valet_claimed_at)
  WHERE valet_claimed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_room_stays_valet_data_filled_at
  ON public.room_stays (valet_data_filled_at)
  WHERE valet_data_filled_at IS NOT NULL;

-- Column comments
COMMENT ON COLUMN public.room_stays.valet_claimed_at IS
  'Timestamp when the cochero taps Accept Entry – marks the start of the entry acceptance flow.';

COMMENT ON COLUMN public.room_stays.valet_data_filled_at IS
  'Timestamp when the cochero finishes filling vehicle data (plates, color, brand). Used to measure data-fill speed.';


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 2: New table room_inspections                                      ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.room_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_stay_id UUID NOT NULL REFERENCES public.room_stays(id),
  room_id UUID NOT NULL REFERENCES public.rooms(id),
  inspection_type TEXT NOT NULL,                  -- 'TV_CHECK', 'DAMAGE_CHECK', 'GENERAL'
  assigned_to UUID REFERENCES public.employees(id),
  assigned_by UUID REFERENCES public.employees(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING',         -- 'PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED'
  notes TEXT,
  result TEXT,                                    -- 'OK', 'ISSUE_FOUND'
  issue_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_room_inspections_stay
  ON public.room_inspections (room_stay_id);

CREATE INDEX IF NOT EXISTS idx_room_inspections_assigned
  ON public.room_inspections (assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_room_inspections_type
  ON public.room_inspections (inspection_type, status);

-- RLS
ALTER TABLE public.room_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select room_inspections"
  ON public.room_inspections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert room_inspections"
  ON public.room_inspections FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update room_inspections"
  ON public.room_inspections FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Column comments
COMMENT ON TABLE public.room_inspections IS
  'Tracks room inspections (TV checks, damage checks, general) assigned to employees during a stay.';

COMMENT ON COLUMN public.room_inspections.inspection_type IS
  'Type of inspection: TV_CHECK, DAMAGE_CHECK, GENERAL';

COMMENT ON COLUMN public.room_inspections.status IS
  'Inspection status: PENDING, ACCEPTED, COMPLETED, CANCELLED';

COMMENT ON COLUMN public.room_inspections.result IS
  'Inspection outcome: OK or ISSUE_FOUND';


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 3: RPC get_cochero_action_metrics                                  ║
-- ║  Returns per-cochero timing for ALL action types beyond check-in/out.    ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

DROP FUNCTION IF EXISTS get_cochero_action_metrics(DATE, DATE);

CREATE OR REPLACE FUNCTION get_cochero_action_metrics(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  employee_id               UUID,
  employee_name             TEXT,
  -- Entry metrics
  avg_entry_acceptance_minutes  DECIMAL,
  avg_entry_data_fill_minutes   DECIMAL,
  total_entries_accepted        INTEGER,
  -- Delivery metrics
  total_deliveries_accepted     INTEGER,
  avg_delivery_acceptance_minutes DECIMAL,
  avg_delivery_execution_minutes  DECIMAL,
  avg_payment_collection_minutes  DECIMAL,
  total_deliveries_completed      INTEGER,
  -- Consumption breakdown
  consumption_deliveries    INTEGER,
  extra_person_deliveries   INTEGER,
  extra_hour_deliveries     INTEGER,
  renewal_deliveries        INTEGER,
  -- Checkout revision metrics
  total_checkout_revisions      INTEGER,
  avg_checkout_revision_minutes DECIMAL,
  min_checkout_revision_minutes DECIMAL,
  max_checkout_revision_minutes DECIMAL,
  -- Inspection metrics
  total_inspections_assigned     INTEGER,
  total_inspections_completed    INTEGER,
  avg_inspection_acceptance_minutes DECIMAL,
  avg_inspection_completion_minutes DECIMAL,
  -- Status
  is_active                 BOOLEAN
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
    -- ENTRY METRICS (from room_stays, using new columns)
    -- ═══════════════════════════════════════════════════════

    -- AVG of (valet_claimed_at - created_at): how fast the cochero accepts the entry
    COALESCE(entry.avg_acceptance, 0)::DECIMAL   AS avg_entry_acceptance_minutes,

    -- AVG of (valet_data_filled_at - valet_claimed_at): how fast they fill vehicle data
    COALESCE(entry.avg_data_fill, 0)::DECIMAL    AS avg_entry_data_fill_minutes,

    -- COUNT of entries accepted by this cochero
    COALESCE(entry.cnt_accepted, 0)::INTEGER     AS total_entries_accepted,

    -- ═══════════════════════════════════════════════════════
    -- DELIVERY METRICS (from sales_order_items)
    -- ═══════════════════════════════════════════════════════
    COALESCE(dlv.cnt_accepted, 0)::INTEGER       AS total_deliveries_accepted,
    COALESCE(dlv.avg_accept, 0)::DECIMAL         AS avg_delivery_acceptance_minutes,
    COALESCE(dlv.avg_exec, 0)::DECIMAL           AS avg_delivery_execution_minutes,
    COALESCE(dlv.avg_payment, 0)::DECIMAL        AS avg_payment_collection_minutes,
    COALESCE(dlv.cnt_completed, 0)::INTEGER      AS total_deliveries_completed,

    -- ═══════════════════════════════════════════════════════
    -- CONSUMPTION BREAKDOWN BY TYPE
    -- ═══════════════════════════════════════════════════════
    COALESCE(dlv.consumption_cnt, 0)::INTEGER    AS consumption_deliveries,
    COALESCE(dlv.extra_person_cnt, 0)::INTEGER   AS extra_person_deliveries,
    COALESCE(dlv.extra_hour_cnt, 0)::INTEGER     AS extra_hour_deliveries,
    COALESCE(dlv.renewal_cnt, 0)::INTEGER        AS renewal_deliveries,

    -- ═══════════════════════════════════════════════════════
    -- CHECKOUT REVISION METRICS (from room_stays)
    -- ═══════════════════════════════════════════════════════
    COALESCE(cout.cnt, 0)::INTEGER               AS total_checkout_revisions,
    COALESCE(cout.avg_min, 0)::DECIMAL           AS avg_checkout_revision_minutes,
    COALESCE(cout.min_min, 0)::DECIMAL           AS min_checkout_revision_minutes,
    COALESCE(cout.max_min, 0)::DECIMAL           AS max_checkout_revision_minutes,

    -- ═══════════════════════════════════════════════════════
    -- INSPECTION METRICS (from room_inspections)
    -- ═══════════════════════════════════════════════════════
    COALESCE(insp.cnt_assigned, 0)::INTEGER      AS total_inspections_assigned,
    COALESCE(insp.cnt_completed, 0)::INTEGER     AS total_inspections_completed,
    COALESCE(insp.avg_accept, 0)::DECIMAL        AS avg_inspection_acceptance_minutes,
    COALESCE(insp.avg_complete, 0)::DECIMAL      AS avg_inspection_completion_minutes,

    -- Status
    (e.deleted_at IS NULL) AS is_active

  FROM employees e
  LEFT JOIN roles rl ON rl.id = e.role_id

  -- ─────────────────────────────────────────────────────────
  -- LATERAL 1: Entry acceptance & data-fill timing
  -- ─────────────────────────────────────────────────────────
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (
        WHERE rs.valet_claimed_at IS NOT NULL
      )::INTEGER AS cnt_accepted,

      ROUND(AVG(accept_mins) FILTER (
        WHERE accept_mins > 0 AND accept_mins <= 30
      )::NUMERIC, 2) AS avg_acceptance,

      ROUND(AVG(fill_mins) FILTER (
        WHERE fill_mins > 0 AND fill_mins <= 30
      )::NUMERIC, 2) AS avg_data_fill
    FROM (
      SELECT
        EXTRACT(EPOCH FROM (rs.valet_claimed_at - rs.created_at)) / 60.0 AS accept_mins,
        EXTRACT(EPOCH FROM (rs.valet_data_filled_at - rs.valet_claimed_at)) / 60.0 AS fill_mins
      FROM room_stays rs
      WHERE rs.valet_employee_id = e.id
        AND DATE(rs.created_at) BETWEEN p_start_date AND p_end_date
    ) rs
  ) entry ON TRUE

  -- ─────────────────────────────────────────────────────────
  -- LATERAL 2: Delivery acceptance, execution, payment & breakdown
  -- ─────────────────────────────────────────────────────────
  LEFT JOIN LATERAL (
    SELECT
      -- Counts
      COUNT(*) FILTER (
        WHERE soi.delivery_accepted_at IS NOT NULL
      )::INTEGER AS cnt_accepted,

      COUNT(*) FILTER (
        WHERE soi.delivery_status IN ('COMPLETED', 'DELIVERED')
      )::INTEGER AS cnt_completed,

      -- Acceptance speed: how fast the cochero taps Accept on the delivery
      ROUND(AVG(
        EXTRACT(EPOCH FROM (soi.delivery_accepted_at - soi.created_at)) / 60.0
      ) FILTER (
        WHERE soi.delivery_accepted_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (soi.delivery_accepted_at - soi.created_at)) / 60.0 > 0
          AND EXTRACT(EPOCH FROM (soi.delivery_accepted_at - soi.created_at)) / 60.0 <= 60
      )::NUMERIC, 2) AS avg_accept,

      -- Execution speed: from acceptance to completion or pickup
      ROUND(AVG(
        EXTRACT(EPOCH FROM (
          COALESCE(soi.delivery_completed_at, soi.delivery_picked_up_at) - soi.delivery_accepted_at
        )) / 60.0
      ) FILTER (
        WHERE soi.delivery_accepted_at IS NOT NULL
          AND COALESCE(soi.delivery_completed_at, soi.delivery_picked_up_at) IS NOT NULL
          AND EXTRACT(EPOCH FROM (
                COALESCE(soi.delivery_completed_at, soi.delivery_picked_up_at) - soi.delivery_accepted_at
              )) / 60.0 > 0
          AND EXTRACT(EPOCH FROM (
                COALESCE(soi.delivery_completed_at, soi.delivery_picked_up_at) - soi.delivery_accepted_at
              )) / 60.0 <= 60
      )::NUMERIC, 2) AS avg_exec,

      -- Payment collection speed: from delivery completion to payment received
      ROUND(AVG(
        EXTRACT(EPOCH FROM (soi.payment_received_at - soi.delivery_completed_at)) / 60.0
      ) FILTER (
        WHERE soi.payment_received_by = e.id
          AND soi.payment_received_at IS NOT NULL
          AND soi.delivery_completed_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (soi.payment_received_at - soi.delivery_completed_at)) / 60.0 > 0
          AND EXTRACT(EPOCH FROM (soi.payment_received_at - soi.delivery_completed_at)) / 60.0 <= 120
      )::NUMERIC, 2) AS avg_payment,

      -- Breakdown by concept_type
      COUNT(*) FILTER (WHERE soi.concept_type = 'CONSUMPTION')::INTEGER  AS consumption_cnt,
      COUNT(*) FILTER (WHERE soi.concept_type = 'EXTRA_PERSON')::INTEGER AS extra_person_cnt,
      COUNT(*) FILTER (WHERE soi.concept_type = 'EXTRA_HOUR')::INTEGER   AS extra_hour_cnt,
      COUNT(*) FILTER (WHERE soi.concept_type = 'RENEWAL')::INTEGER      AS renewal_cnt

    FROM sales_order_items soi
    JOIN room_stays rs_link ON rs_link.sales_order_id = soi.sales_order_id
    WHERE soi.delivery_accepted_by = e.id
      AND DATE(soi.created_at) BETWEEN p_start_date AND p_end_date
  ) dlv ON TRUE

  -- ─────────────────────────────────────────────────────────
  -- LATERAL 3: Checkout revision timing
  -- ─────────────────────────────────────────────────────────
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS cnt,
      ROUND(AVG(mins)::NUMERIC, 2)  AS avg_min,
      ROUND(MIN(mins)::NUMERIC, 2)  AS min_min,
      ROUND(MAX(mins)::NUMERIC, 2)  AS max_min
    FROM (
      SELECT
        EXTRACT(EPOCH FROM (rs.valet_checkout_requested_at - rs.vehicle_requested_at)) / 60.0 AS mins
      FROM room_stays rs
      WHERE rs.checkout_valet_employee_id = e.id
        AND rs.valet_checkout_requested_at IS NOT NULL
        AND rs.vehicle_requested_at IS NOT NULL
        AND DATE(rs.created_at) BETWEEN p_start_date AND p_end_date
        AND EXTRACT(EPOCH FROM (rs.valet_checkout_requested_at - rs.vehicle_requested_at)) / 60.0 > 0
        AND EXTRACT(EPOCH FROM (rs.valet_checkout_requested_at - rs.vehicle_requested_at)) / 60.0 <= 60
    ) t
  ) cout ON TRUE

  -- ─────────────────────────────────────────────────────────
  -- LATERAL 4: Room inspection timing
  -- ─────────────────────────────────────────────────────────
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS cnt_assigned,

      COUNT(*) FILTER (
        WHERE ri.status = 'COMPLETED'
      )::INTEGER AS cnt_completed,

      -- Acceptance speed: assigned_at → accepted_at
      ROUND(AVG(
        EXTRACT(EPOCH FROM (ri.accepted_at - ri.assigned_at)) / 60.0
      ) FILTER (
        WHERE ri.accepted_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (ri.accepted_at - ri.assigned_at)) / 60.0 > 0
          AND EXTRACT(EPOCH FROM (ri.accepted_at - ri.assigned_at)) / 60.0 <= 60
      )::NUMERIC, 2) AS avg_accept,

      -- Completion speed: accepted_at → completed_at
      ROUND(AVG(
        EXTRACT(EPOCH FROM (ri.completed_at - ri.accepted_at)) / 60.0
      ) FILTER (
        WHERE ri.completed_at IS NOT NULL
          AND ri.accepted_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (ri.completed_at - ri.accepted_at)) / 60.0 > 0
          AND EXTRACT(EPOCH FROM (ri.completed_at - ri.accepted_at)) / 60.0 <= 60
      )::NUMERIC, 2) AS avg_complete

    FROM room_inspections ri
    WHERE ri.assigned_to = e.id
      AND DATE(ri.assigned_at) BETWEEN p_start_date AND p_end_date
  ) insp ON TRUE

  -- Only cochero/valet employees
  WHERE LOWER(e.role) IN ('valet', 'cochero')
     OR LOWER(rl.name) IN ('valet', 'cochero');

END;
$$;

COMMENT ON FUNCTION get_cochero_action_metrics(DATE, DATE) IS
  'Returns per-cochero granular timing for entries (acceptance + data fill), deliveries (acceptance + execution + payment), checkout revisions, and room inspections. Used by the management dashboard for detailed valet performance analysis.';


-- ═══════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '✓ Part 1: Added valet_claimed_at, valet_data_filled_at to room_stays';
  RAISE NOTICE '✓ Part 2: Created room_inspections table with RLS';
  RAISE NOTICE '✓ Part 3: Created get_cochero_action_metrics(DATE, DATE) RPC';
END $$;

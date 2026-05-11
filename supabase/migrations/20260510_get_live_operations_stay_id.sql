CREATE OR REPLACE FUNCTION public.get_live_operations(
  p_limit INT DEFAULT 50,
  p_status TEXT DEFAULT 'ALL',
  p_shift_id UUID DEFAULT NULL,
  p_stay_id UUID DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_shift_start timestamptz;
  v_shift_end timestamptz;
BEGIN
  IF p_shift_id IS NOT NULL THEN
    SELECT clock_in_at, clock_out_at INTO v_shift_start, v_shift_end
    FROM shift_sessions WHERE id = p_shift_id;
  END IF;

  SELECT COALESCE(jsonb_agg(flow_data), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT 
      jsonb_build_object(
        'id', rs.id,
        'visualId', 'FL-' || UPPER(SUBSTRING(rs.id::text, 1, 6)),
        'roomId', r.id,
        'roomNumber', r.number,
        'roomTypeName', rt.name,
        'status', rs.status,
        'checkInAt', rs.check_in_at,
        'checkOutAt', rs.actual_check_out_at,
        'expectedCheckOutAt', rs.expected_check_out_at,
        'vehiclePlate', rs.vehicle_plate,
        'valetEmployeeId', rs.valet_employee_id,
        'receptionEmployeeId', (
          SELECT ss.employee_id 
          FROM shift_sessions ss 
          JOIN employees e ON e.id = ss.employee_id 
          WHERE e.role IN ('receptionist', 'admin', 'manager') 
            AND ss.clock_in_at <= rs.check_in_at 
            AND (ss.clock_out_at IS NULL OR ss.clock_out_at >= rs.check_in_at)
          ORDER BY ss.clock_in_at DESC LIMIT 1
        ),
        'events', COALESCE((
          SELECT jsonb_agg(event_data ORDER BY createdAt ASC)
          FROM (
            
            -- 1. General Audit Logs
            SELECT 
              jsonb_build_object(
                'id', al.id::text,
                'action', COALESCE(al.action, al.event_type),
                'severity', al.severity,
                'createdAt', al.created_at,
                'description', al.description,
                'metadata', al.metadata,
                'employeeName', al.employee_name,
                'employeeRole', (SELECT role FROM employees WHERE first_name || ' ' || last_name = al.employee_name LIMIT 1),
                'amount', al.amount
              ) as event_data,
              al.created_at as createdAt
            FROM audit_logs al
            WHERE al.metadata->>'stay_id' = rs.id::text 
               OR (al.metadata->>'room_id' = r.id::text 
                   AND al.created_at >= rs.check_in_at - interval '5 minutes'
                   AND al.created_at <= COALESCE(rs.actual_check_out_at, now()) + interval '10 minutes')
                   
            UNION ALL
            
            -- 2. Asset Logs (Cochero assignments)
            SELECT 
              jsonb_build_object(
                'id', 'asset-' || ral.id::text,
                'action', ral.action_type,
                'severity', CASE WHEN ral.action_type LIKE '%MISSING%' THEN 'WARNING' ELSE 'INFO' END,
                'createdAt', ral.created_at,
                'description', ral.notes,
                'employeeName', COALESCE(
                  (SELECT first_name || ' ' || last_name FROM employees WHERE id = ral.employee_id),
                  (SELECT first_name || ' ' || last_name FROM employees WHERE id = ral.assigned_to_employee_id)
                ),
                'employeeRole', COALESCE(
                  (SELECT role FROM employees WHERE id = ral.employee_id),
                  (SELECT role FROM employees WHERE id = ral.assigned_to_employee_id)
                ),
                'metadata', jsonb_build_object('assigned_to', ral.assigned_to_employee_id)
              ),
              ral.created_at as createdAt
            FROM room_asset_logs ral
            JOIN room_assets ra ON ra.id = ral.asset_id
            WHERE ra.room_id = rs.room_id 
              AND ral.created_at >= rs.check_in_at - interval '30 minutes'
              AND ral.created_at <= COALESCE(rs.actual_check_out_at, now())
            
            UNION ALL
            
            -- 3. Tolerance
            SELECT 
              jsonb_build_object(
                'id', 'v-tol-start-' || rs.id, 
                'action', 'TOLERANCE', 
                'severity', 'WARNING', 
                'createdAt', rs.tolerance_started_at,
                'description', 'Se activó tiempo de tolerancia (' || COALESCE(rs.tolerance_started_at::text, 'Por definir') || ').'
              ),
              rs.tolerance_started_at
            WHERE rs.tolerance_started_at IS NOT NULL
            
            UNION ALL
            
            -- 4. Valet Checkout Requested (Revisión de Salida)
            SELECT 
              jsonb_build_object(
                'id', 'v-checkout-req-' || rs.id, 
                'action', 'VALET_CHECKOUT_REQUESTED', 
                'severity', 'INFO', 
                'createdAt', rs.valet_checkout_requested_at,
                'description', 'Cochero finalizó la revisión e indicó que la habitación está lista para salida definitiva.',
                'employeeName', (SELECT first_name || ' ' || last_name FROM employees WHERE id = rs.checkout_valet_employee_id),
                'employeeRole', (SELECT role FROM employees WHERE id = rs.checkout_valet_employee_id)
              ),
              rs.valet_checkout_requested_at
            WHERE rs.valet_checkout_requested_at IS NOT NULL
            
            UNION ALL
            
            -- 5. Vehicle Request
            SELECT 
              jsonb_build_object(
                'id', 'v-vehicle-req-' || rs.id, 
                'action', 'VEHICLE_REQUESTED', 
                'severity', 'INFO', 
                'createdAt', rs.vehicle_requested_at,
                'description', 'El huésped solicitó la entrega de su vehículo en la puerta.',
                'employeeName', (SELECT first_name || ' ' || last_name FROM employees WHERE id = rs.valet_employee_id),
                'employeeRole', (SELECT role FROM employees WHERE id = rs.valet_employee_id)
              ),
              rs.vehicle_requested_at
            WHERE rs.vehicle_requested_at IS NOT NULL
            
            UNION ALL
            
            -- 6. Payments Collected (Cochero)
            SELECT 
              jsonb_build_object(
                'id', 'v-pay-col-' || p.id, 
                'action', 'PAYMENT_COLLECTED_BY_VALET', 
                'severity', 'INFO', 
                'createdAt', p.collected_at,
                'description', 'Cochero guardó datos del cobro.',
                'metadata', to_jsonb(p),
                'employeeName', (SELECT first_name || ' ' || last_name FROM employees WHERE id = p.collected_by),
                'employeeRole', (SELECT role FROM employees WHERE id = p.collected_by),
                'amount', p.amount
              ),
              p.collected_at
            FROM payments p
            JOIN sales_orders so ON so.id = p.sales_order_id
            WHERE so.id = rs.sales_order_id AND p.collected_at IS NOT NULL
            
            UNION ALL
            
            -- 7. Payments Confirmed (Recepción)
            SELECT 
              jsonb_build_object(
                'id', 'v-pay-conf-' || p.id, 
                'action', 'PAYMENT_CONFIRMED_BY_RECEPTION', 
                'severity', 'INFO', 
                'createdAt', p.confirmed_at,
                'description', 'Recepción corroboró y dio por ingresado el dinero a la caja.',
                'metadata', to_jsonb(p),
                'employeeName', (SELECT first_name || ' ' || last_name FROM employees WHERE id = p.confirmed_by),
                'employeeRole', (SELECT role FROM employees WHERE id = p.confirmed_by),
                'amount', p.amount
              ),
              p.confirmed_at
            FROM payments p
            JOIN sales_orders so ON so.id = p.sales_order_id
            WHERE so.id = rs.sales_order_id AND p.confirmed_at IS NOT NULL AND p.status = 'PAGADO'
            
            UNION ALL
            
            -- 8. Service Order Synthesis
            SELECT 
              jsonb_build_object(
                'id', 'v-srv-' || soi.id, 
                'action', 'SERVICE_ORDER', 
                'severity', 'INFO', 
                'createdAt', soi.created_at,
                'description', 'Servicio solicitado: ' || CASE WHEN soi.concept_type = 'ROOM_BASE' THEN 'Renta de Habitación (' || rt.name || ')' ELSE COALESCE(pr.name, soi.concept_type, 'ARTÍCULO') END,
                'amount', soi.total,
                'employeeName', (SELECT first_name || ' ' || last_name FROM employees e JOIN shift_sessions ss ON ss.employee_id = e.id WHERE ss.id = soi.shift_session_id),
                'employeeRole', (SELECT role FROM employees e JOIN shift_sessions ss ON ss.employee_id = e.id WHERE ss.id = soi.shift_session_id),
                'metadata', jsonb_build_object(
                  'folio', UPPER(SUBSTRING(soi.id::text, 1, 6)),
                  'concept', CASE WHEN soi.concept_type = 'ROOM_BASE' THEN 'Habitación (' || rt.name || ')' ELSE COALESCE(pr.name, soi.concept_type) END,
                  'qty', soi.qty,
                  'total', soi.total,
                  'status', soi.delivery_status,
                  'createdAt', soi.created_at,
                  'createdBy', (SELECT first_name || ' ' || last_name FROM employees e JOIN shift_sessions ss ON ss.employee_id = e.id WHERE ss.id = soi.shift_session_id),
                  'acceptedAt', soi.delivery_accepted_at,
                  'acceptedBy', (SELECT first_name || ' ' || last_name FROM employees WHERE id = soi.delivery_accepted_by),
                  'completedAt', soi.delivery_completed_at,
                  'cancelledAt', soi.cancelled_at,
                  'cancelledBy', (SELECT first_name || ' ' || last_name FROM employees WHERE id = soi.cancelled_by),
                  'cancellationReason', soi.cancellation_reason,
                  'tipAmount', soi.tip_amount,
                  'notes', soi.delivery_notes,
                  'isPaid', soi.is_paid,
                  'paymentMethod', soi.payment_method,
                  'paymentReceivedAt', soi.payment_received_at,
                  'paymentReceivedBy', (SELECT first_name || ' ' || last_name FROM employees WHERE id = soi.payment_received_by),
                  'paymentAmountReceived', soi.payment_amount_received
                )
              ),
              soi.created_at
            FROM sales_order_items soi
            JOIN sales_orders so ON so.id = soi.sales_order_id
            LEFT JOIN products pr ON pr.id = soi.product_id
            WHERE so.id = rs.sales_order_id
            
          ) sub_events
        ), '[]'::jsonb)
      ) as flow_data
    FROM room_stays rs
    JOIN rooms r ON r.id = rs.room_id
    JOIN room_types rt ON rt.id = r.room_type_id
    WHERE 
      (p_stay_id IS NULL OR rs.id = p_stay_id)
      AND (
        p_stay_id IS NOT NULL OR (
          (p_status = 'ALL' OR rs.status = p_status)
          AND (
            p_shift_id IS NULL OR 
            (rs.check_in_at >= v_shift_start AND (v_shift_end IS NULL OR rs.check_in_at <= v_shift_end))
          )
        )
      )
    ORDER BY rs.check_in_at DESC
    LIMIT p_limit
  ) main_query;

  RETURN v_result;
END;
$$;

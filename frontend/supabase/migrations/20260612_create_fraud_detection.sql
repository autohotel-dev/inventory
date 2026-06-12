-- ================================================================
-- Fraud Detection & Anomaly Alerts
-- Detects inconsistencies between receptionist and valet data
-- ================================================================

CREATE OR REPLACE FUNCTION detect_operation_anomalies()
RETURNS TABLE (
    flow_id UUID,
    room_number TEXT,
    anomaly_type TEXT,
    severity TEXT,
    description TEXT,
    details JSONB,
    detected_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec RECORD;
    flow_rec RECORD;
    valet_paid NUMERIC;
    reception_registered NUMERIC;
    valet_persons INT;
    reception_persons INT;
    has_room_assigned BOOLEAN;
    has_payment_collected BOOLEAN;
    has_payment_registered BOOLEAN;
    has_form_submitted BOOLEAN;
    has_reminder BOOLEAN;
    event_count INT;
    extra_hours_count INT;
    extra_hours_charged INT;
BEGIN
    -- Loop through active flows
    FOR flow_rec IN
        SELECT f.id AS flow_id, f.room_number, f.started_at, f.room_stay_id
        FROM operation_flows f
        WHERE f.status = 'ACTIVO'
        ORDER BY f.started_at DESC
    LOOP
        -- Count events by type
        SELECT COUNT(*) INTO event_count FROM flow_events WHERE flow_id = flow_rec.flow_id;

        SELECT EXISTS(SELECT 1 FROM flow_events WHERE flow_id = flow_rec.flow_id AND event_type = 'ROOM_ASSIGNED') INTO has_room_assigned;
        SELECT EXISTS(SELECT 1 FROM flow_events WHERE flow_id = flow_rec.flow_id AND event_type = 'VALET_PAYMENT_COLLECTED') INTO has_payment_collected;
        SELECT EXISTS(SELECT 1 FROM flow_events WHERE flow_id = flow_rec.flow_id AND event_type IN ('PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED')) INTO has_payment_registered;
        SELECT EXISTS(SELECT 1 FROM flow_events WHERE flow_id = flow_rec.flow_id AND event_type = 'VALET_FORM_SUBMITTED') INTO has_form_submitted;
        SELECT EXISTS(SELECT 1 FROM flow_events WHERE flow_id = flow_rec.flow_id AND event_type = 'REMINDER_SENT') INTO has_reminder;

        -- ANOMALY 1: Valet collected payment but reception never registered it
        IF has_payment_collected AND NOT has_payment_registered THEN
            -- Get valet collected amount
            SELECT COALESCE((metadata->>'total_paid')::NUMERIC, 0) INTO valet_paid
            FROM flow_events WHERE flow_id = flow_rec.flow_id AND event_type = 'VALET_PAYMENT_COLLECTED'
            ORDER BY created_at DESC LIMIT 1;

            IF valet_paid > 0 THEN
                flow_id := flow_rec.flow_id;
                room_number := flow_rec.room_number;
                anomaly_type := 'PAYMENT_NOT_REGISTERED';
                severity := 'CRITICAL';
                description := format('Cochero cobró $%s pero recepción nunca registró el pago', valet_paid);
                details := jsonb_build_object(
                    'valet_amount', valet_paid,
                    'has_payment_collected', true,
                    'has_payment_registered', false
                );
                detected_at := NOW();
                RETURN NEXT;
            END IF;
        END IF;

        -- ANOMALY 2: Discrepancy in person count (valet vs reception)
        IF has_form_submitted THEN
            SELECT COALESCE((metadata->>'person_count')::INT, 0) INTO valet_persons
            FROM flow_events WHERE flow_id = flow_rec.flow_id AND event_type = 'VALET_FORM_SUBMITTED'
            ORDER BY created_at DESC LIMIT 1;

            SELECT rs.current_people INTO reception_persons
            FROM room_stays rs WHERE rs.id = flow_rec.room_stay_id;

            IF valet_persons > 0 AND reception_persons > 0 AND valet_persons != reception_persons THEN
                flow_id := flow_rec.flow_id;
                room_number := flow_rec.room_number;
                anomaly_type := 'PERSON_COUNT_MISMATCH';
                severity := 'HIGH';
                description := format('Discrepancia de personas: cochero reportó %s, recepción registró %s', valet_persons, reception_persons);
                details := jsonb_build_object(
                    'valet_persons', valet_persons,
                    'reception_persons', reception_persons,
                    'difference', ABS(valet_persons - reception_persons)
                );
                detected_at := NOW();
                RETURN NEXT;
            END IF;
        END IF;

        -- ANOMALY 3: Entry logged but no valet form submitted (after 10+ minutes)
        IF has_room_assigned AND NOT has_form_submitted THEN
            IF EXTRACT(EPOCH FROM (NOW() - flow_rec.started_at)) > 600 THEN
                flow_id := flow_rec.flow_id;
                room_number := flow_rec.room_number;
                anomaly_type := 'NO_VALET_FORM';
                severity := 'MEDIUM';
                description := 'Habitación asignada hace más de 10 minutos pero cochero no ha enviado formulario';
                details := jsonb_build_object(
                    'minutes_elapsed', EXTRACT(EPOCH FROM (NOW() - flow_rec.started_at)) / 60,
                    'has_room_assigned', true,
                    'has_form_submitted', false
                );
                detected_at := NOW();
                RETURN NEXT;
            END IF;
        END IF;

        -- ANOMALY 4: Reminder sent but no action taken (after 5+ minutes)
        IF has_reminder THEN
            IF NOT has_form_submitted THEN
                IF EXISTS (
                    SELECT 1 FROM flow_events
                    WHERE flow_id = flow_rec.flow_id AND event_type = 'REMINDER_SENT'
                    AND EXTRACT(EPOCH FROM (NOW() - created_at)) > 300
                ) THEN
                    flow_id := flow_rec.flow_id;
                    room_number := flow_rec.room_number;
                    anomaly_type := 'REMINDER_IGNORED';
                    severity := 'MEDIUM';
                    description := 'Recordatorio enviado hace más de 5 minutos sin respuesta del cochero';
                    details := jsonb_build_object('has_form_submitted', false);
                    detected_at := NOW();
                    RETURN NEXT;
                END IF;
            END IF;
        END IF;

        -- ANOMALY 5: Payment amount mismatch (valet vs reception)
        IF has_payment_collected AND has_payment_registered THEN
            SELECT COALESCE((metadata->>'total_paid')::NUMERIC, 0) INTO valet_paid
            FROM flow_events WHERE flow_id = flow_rec.flow_id AND event_type = 'VALET_PAYMENT_COLLECTED'
            ORDER BY created_at DESC LIMIT 1;

            SELECT COALESCE((metadata->>'amount')::NUMERIC, 0) INTO reception_registered
            FROM flow_events WHERE flow_id = flow_rec.flow_id AND event_type IN ('PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED')
            ORDER BY created_at DESC LIMIT 1;

            IF valet_paid > 0 AND reception_registered > 0 AND ABS(valet_paid - reception_registered) > 0.50 THEN
                flow_id := flow_rec.flow_id;
                room_number := flow_rec.room_number;
                anomaly_type := 'PAYMENT_AMOUNT_MISMATCH';
                severity := 'CRITICAL';
                description := format('Discrepancia en monto: cochero cobró $%s, recepción registró $%s (diferencia: $%s)', valet_paid, reception_registered, ABS(valet_paid - reception_registered));
                details := jsonb_build_object(
                    'valet_amount', valet_paid,
                    'reception_amount', reception_registered,
                    'difference', ABS(valet_paid - reception_registered)
                );
                detected_at := NOW();
                RETURN NEXT;
            END IF;
        END IF;

        -- ANOMALY 6: Unusually fast checkout (possible fraud)
        IF event_count >= 3 THEN
            IF EXTRACT(EPOCH FROM (NOW() - flow_rec.started_at)) < 120 THEN
                flow_id := flow_rec.flow_id;
                room_number := flow_rec.room_number;
                anomaly_type := 'UNUSUALLY_FAST';
                severity := 'LOW';
                description := format('Proceso completado en menos de 2 minutos (%s eventos)', event_count);
                details := jsonb_build_object('seconds_elapsed', EXTRACT(EPOCH FROM (NOW() - flow_rec.started_at)));
                detected_at := NOW();
                RETURN NEXT;
            END IF;
        END IF;

    END LOOP;
END;
$$;

-- RPC to get current anomalies
CREATE OR REPLACE FUNCTION get_operation_anomalies()
RETURNS TABLE (
    flow_id UUID,
    room_number TEXT,
    anomaly_type TEXT,
    severity TEXT,
    description TEXT,
    details JSONB,
    detected_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY SELECT * FROM detect_operation_anomalies();
END;
$$;

-- ================================================================
-- Collusion Detection
-- Detects suspicious patterns between valet-receptionist pairs
-- ================================================================

CREATE OR REPLACE FUNCTION detect_collusion_patterns()
RETURNS TABLE (
    pair_key TEXT,
    anomaly_type TEXT,
    severity TEXT,
    description TEXT,
    details JSONB,
    detected_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    pair_rec RECORD;
    total_flows INT;
    unregistered_count INT;
    mismatch_count INT;
    courtesy_count INT;
    unregistered_pct NUMERIC;
BEGIN
    -- Find valet-receptionist pairs with multiple anomalies
    FOR pair_rec IN
        SELECT
            valet_actor->>'actor_id' AS valet_id,
            valet_actor->>'actor_name' AS valet_name,
            reception_actor->>'actor_id' AS reception_id,
            reception_actor->>'actor_name' AS reception_name,
            COUNT(DISTINCT fe.flow_id) AS anomaly_count
        FROM flow_events fe
        JOIN flow_events valet_actor ON valet_actor.flow_id = fe.flow_id
            AND valet_actor.event_type IN ('VALET_PAYMENT_COLLECTED', 'VALET_FORM_SUBMITTED')
        JOIN flow_events reception_actor ON reception_actor.flow_id = fe.flow_id
            AND reception_actor.event_type IN ('ROOM_ASSIGNED', 'PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED')
        WHERE fe.event_type IN ('PAYMENT_NOT_REGISTERED', 'PERSON_COUNT_MISMATCH', 'PAYMENT_AMOUNT_MISMATCH')
        GROUP BY valet_actor->>'actor_id', valet_actor->>'actor_name',
                 reception_actor->>'actor_id', reception_actor->>'actor_name'
        HAVING COUNT(DISTINCT fe.flow_id) >= 2
    LOOP
        -- Check if this pair has repeated payment-not-registered
        SELECT COUNT(DISTINCT fe.flow_id) INTO unregistered_count
        FROM flow_events fe
        WHERE fe.event_type = 'PAYMENT_NOT_REGISTERED'
        AND fe.flow_id IN (
            SELECT f2.id FROM operation_flows f2
            WHERE f2.created_by::text = pair_rec.reception_id
        )
        AND fe.flow_id IN (
            SELECT fe2.flow_id FROM flow_events fe2
            WHERE fe2.actor_id::text = pair_rec.valet_id
        );

        -- Check repeated person count mismatches
        SELECT COUNT(DISTINCT fe.flow_id) INTO mismatch_count
        FROM flow_events fe
        WHERE fe.event_type = 'PERSON_COUNT_MISMATCH'
        AND fe.flow_id IN (
            SELECT f2.id FROM operation_flows f2
            WHERE f2.created_by::text = pair_rec.reception_id
        )
        AND fe.flow_id IN (
            SELECT fe2.flow_id FROM flow_events fe2
            WHERE fe2.actor_id::text = pair_rec.valet_id
        );

        -- ANOMALY: Repeated unregistered payments between same pair
        IF unregistered_count >= 2 THEN
            pair_key := pair_rec.valet_name || ' + ' || pair_rec.reception_name;
            anomaly_type := 'REPEATED_UNREGISTERED_PAYMENTS';
            severity := 'CRITICAL';
            description := format('%s pagos no registrados entre mismo par cochero-recepcionista', unregistered_count);
            details := jsonb_build_object(
                'valet_id', pair_rec.valet_id,
                'valet_name', pair_rec.valet_name,
                'reception_id', pair_rec.reception_id,
                'reception_name', pair_rec.reception_name,
                'occurrences', unregistered_count
            );
            detected_at := NOW();
            RETURN NEXT;
        END IF;

        -- ANOMALY: Repeated person count mismatches
        IF mismatch_count >= 2 THEN
            pair_key := pair_rec.valet_name || ' + ' || pair_rec.reception_name;
            anomaly_type := 'REPEATED_PERSON_MISMATCH';
            severity := 'HIGH';
            description := format('%s discrepancias de personas entre mismo par', mismatch_count);
            details := jsonb_build_object(
                'valet_id', pair_rec.valet_id,
                'valet_name', pair_rec.valet_name,
                'reception_id', pair_rec.reception_id,
                'reception_name', pair_rec.reception_name,
                'occurrences', mismatch_count
            );
            detected_at := NOW();
            RETURN NEXT;
        END IF;

    END LOOP;

    -- Check for unusually high courtesy rate between specific pairs
    FOR pair_rec IN
        SELECT
            ca.actor_name AS reception_name,
            ca.actor_id AS reception_id,
            COUNT(*) AS courtesy_count
        FROM flow_events ca
        WHERE ca.event_type = 'COURTESY_APPLIED'
        GROUP BY ca.actor_name, ca.actor_id
        HAVING COUNT(*) >= 3
    LOOP
        -- Check if same receptionist also has rooms where valet collected payment
        SELECT COUNT(DISTINCT fe.flow_id) INTO unregistered_count
        FROM flow_events fe
        WHERE fe.event_type = 'VALET_PAYMENT_COLLECTED'
        AND fe.flow_id IN (
            SELECT f2.id FROM operation_flows f2
            WHERE f2.created_by::text = pair_rec.reception_id
        )
        AND fe.flow_id NOT IN (
            SELECT fe2.flow_id FROM flow_events fe2
            WHERE fe2.event_type IN ('PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED')
        );

        IF unregistered_count >= 2 THEN
            pair_key := pair_rec.reception_name || ' (cortesias)';
            anomaly_type := 'HIGH_COURTESY_WITH_UNREGISTERED';
            severity := 'CRITICAL';
            description := format('%s cortesias aplicadas con %s pagos sin registrar por misma recepcionista', pair_rec.courtesy_count, unregistered_count);
            details := jsonb_build_object(
                'reception_id', pair_rec.reception_id,
                'reception_name', pair_rec.reception_name,
                'courtesy_count', pair_rec.courtesy_count,
                'unregistered_count', unregistered_count
            );
            detected_at := NOW();
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;

-- RPC to get collusion patterns
CREATE OR REPLACE FUNCTION get_collusion_patterns()
RETURNS TABLE (
    pair_key TEXT,
    anomaly_type TEXT,
    severity TEXT,
    description TEXT,
    details JSONB,
    detected_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY SELECT * FROM detect_collusion_patterns();
END;
$$;

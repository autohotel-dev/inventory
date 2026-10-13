-- Red de seguridad para celulares con la versión anterior de la app del cochero.
--
-- La app vieja cambia `status` directo en la tabla (sin resolve_loaned_item) y, al marcar
-- Faltante, ella misma genera un cargo por daño. Sin esta protección, recepción vería ese
-- faltante "sin decidir" en el POS y podría cobrarlo otra vez.
--
-- Un cambio de estado que no viene de resolve_loaned_item (que marca la transacción con
-- app.loan_rpc = 'on'):
--   * PERDIDO   -> queda decidido como COBRADO (la app vieja ya generó el cargo)
--   * cualquiera -> se registra quién y cuándo, tomando al empleado de la sesión
--   * ANULADO / CERRADO_SIN_REVISION no se pueden modificar (se ignora el cambio)
-- Se puede quitar cuando ya no quede ninguna app vieja en uso.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_direct_loan_status_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_emp uuid;
    v_price numeric;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status
       OR coalesce(current_setting('app.loan_rpc', true), '') = 'on' THEN
        RETURN NEW;
    END IF;

    IF OLD.status IN ('ANULADO', 'CERRADO_SIN_REVISION') THEN
        NEW.status := OLD.status;
        RETURN NEW;
    END IF;

    SELECT id INTO v_emp FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
    NEW.checked_by := coalesce(v_emp, NEW.checked_by);
    NEW.checked_at := now();

    IF NEW.status = 'PERDIDO' AND NEW.damage_decision IS NULL THEN
        SELECT damage_price INTO v_price FROM loan_item_catalog WHERE id = NEW.loan_item_id;
        NEW.damage_decision := 'COBRADO';
        NEW.damage_amount   := coalesce(v_price, 0) * NEW.quantity;
        NEW.decided_by      := v_emp;
        NEW.decided_at      := now();
        NEW.notes := concat_ws(' | ', NEW.notes, 'Cargo automático de la app del cochero (versión anterior)');
    ELSIF NEW.status = 'RECUPERADO' THEN
        NEW.recovered_by := coalesce(v_emp, NEW.recovered_by);
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_direct_loan_status_change() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS tr_guard_direct_loan_status_change ON public.stay_loaned_items;
CREATE TRIGGER tr_guard_direct_loan_status_change
  BEFORE UPDATE OF status ON public.stay_loaned_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_direct_loan_status_change();

-- resolve_loaned_item marca su transacción para que la protección no la trate como app vieja
CREATE OR REPLACE FUNCTION public.resolve_loaned_item(p_loan_id uuid, p_status text, p_note text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_emp   employees%ROWTYPE;
    v_loan  stay_loaned_items%ROWTYPE;
    v_item  loan_item_catalog%ROWTYPE;
    v_room  text;
BEGIN
    SELECT * INTO v_emp FROM employees
     WHERE auth_user_id = auth.uid() AND is_active AND deleted_at IS NULL
     LIMIT 1;
    IF v_emp.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Empleado no identificado');
    END IF;

    IF p_status NOT IN ('RECUPERADO', 'PERDIDO') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Estado inválido');
    END IF;

    SELECT * INTO v_loan FROM stay_loaned_items WHERE id = p_loan_id FOR UPDATE;
    IF v_loan.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Préstamo no encontrado');
    END IF;
    IF v_loan.status NOT IN ('PRESTADO', 'RECUPERADO', 'PERDIDO') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este préstamo ya no se puede modificar (' || v_loan.status || ')');
    END IF;
    IF v_loan.damage_decision IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Recepción ya decidió sobre este faltante');
    END IF;
    IF v_loan.status = p_status THEN
        RETURN jsonb_build_object('success', true, 'status', p_status, 'unchanged', true);
    END IF;

    PERFORM set_config('app.loan_rpc', 'on', true);
    UPDATE stay_loaned_items SET
        status       = p_status,
        checked_by   = v_emp.id,
        checked_at   = now(),
        recovered_by = CASE WHEN p_status = 'RECUPERADO' THEN v_emp.id END,
        notes        = CASE WHEN nullif(trim(p_note), '') IS NULL THEN notes
                            ELSE concat_ws(' | ', notes, trim(p_note)) END
    WHERE id = p_loan_id;
    PERFORM set_config('app.loan_rpc', '', true);

    IF p_status = 'PERDIDO' THEN
        SELECT * INTO v_item FROM loan_item_catalog WHERE id = v_loan.loan_item_id;
        SELECT r.number INTO v_room FROM room_stays s JOIN rooms r ON r.id = s.room_id WHERE s.id = v_loan.room_stay_id;

        INSERT INTO notifications (user_id, type, title, message, data, is_read)
        SELECT DISTINCT e.auth_user_id, 'system_alert', '⚠️ Artículo faltante',
               format('Hab. %s: falta %s x%s (reportó %s). Decide si se cobra o se perdona.',
                      coalesce(v_room, '?'), coalesce(v_item.name, 'artículo'), v_loan.quantity, v_emp.first_name),
               jsonb_build_object('type', 'LOAN_MISSING', 'loanId', v_loan.id, 'stayId', v_loan.room_stay_id),
               false
        FROM shift_sessions ss
        JOIN employees e ON e.id = ss.employee_id
        WHERE ss.status IN ('active', 'open')
          AND e.role IN ('receptionist', 'admin', 'manager', 'supervisor', 'gerente')
          AND e.auth_user_id IS NOT NULL;
    END IF;

    RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$function$;

COMMIT;

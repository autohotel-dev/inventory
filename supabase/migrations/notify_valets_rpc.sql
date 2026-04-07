-- Función RPC para notificar a todos los cocheros/valets activos
-- Nombre: send_valet_notification (para no colisionar con trigger notify_valets existente)
-- Usa SECURITY DEFINER para bypass RLS (se ejecuta con permisos del owner, no del caller)
-- Esto significa que recepcionistas pueden llamarla y notificará a cocheros sin problemas de RLS.

CREATE OR REPLACE FUNCTION send_valet_notification(p_title text, p_message text, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb AS $$
DECLARE
  inserted_count int;
  active_count int;
BEGIN
  -- Primero intentar enviar solo a cocheros con sesión activa
  INSERT INTO notifications (user_id, type, title, message, data, is_read)
  SELECT DISTINCT e.auth_user_id, 'system_alert', p_title, p_message, p_data, false
  FROM employees e
  INNER JOIN shift_sessions ss ON ss.employee_id = e.id AND ss.status = 'active'
  WHERE e.role IN ('valet', 'cochero', 'Cochero')
    AND e.is_active = true
    AND e.auth_user_id IS NOT NULL;

  GET DIAGNOSTICS active_count = ROW_COUNT;

  -- Si no había sesiones activas, enviar a TODOS los cocheros como fallback
  IF active_count = 0 THEN
    INSERT INTO notifications (user_id, type, title, message, data, is_read)
    SELECT DISTINCT e.auth_user_id, 'system_alert', p_title, p_message, p_data, false
    FROM employees e
    WHERE e.role IN ('valet', 'cochero', 'Cochero')
      AND e.is_active = true
      AND e.auth_user_id IS NOT NULL;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    
    RETURN jsonb_build_object(
      'sent', inserted_count,
      'active_sessions', 0,
      'fallback', true
    );
  END IF;

  RETURN jsonb_build_object(
    'sent', active_count,
    'active_sessions', active_count,
    'fallback', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

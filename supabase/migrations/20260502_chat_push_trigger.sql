-- =====================================================
-- SISTEMA COMPLETO DE NOTIFICACIONES PUSH PARA CHAT
-- =====================================================
-- Ejecutar COMPLETO en el SQL Editor de Supabase.
-- Este script configura el flujo:
--   Message INSERT → Trigger → notifications table → Trigger → Edge Function → Expo Push
-- =====================================================

-- =====================================================
-- PASO 1: Actualizar constraint de tipos de notificación
-- =====================================================
DO $$ 
BEGIN
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'stock_low', 'stock_critical', 'order_pending', 'payment_due', 
      'shift_started', 'shift_ended', 'system_alert', 'info',
      'NEW_EXTRA', 'NEW_CONSUMPTION', 'DAMAGE_REPORT', 'PROMO_4H', 'ROOM_CHANGE', 'NEW_ENTRY',
      'chat_message'
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint update skipped: %', SQLERRM;
END $$;

-- =====================================================
-- PASO 2: Trigger que crea notificaciones para participantes del chat
-- (Cuando llega un mensaje, notifica a TODOS los participantes EXCEPTO al remitente)
-- =====================================================
CREATE OR REPLACE FUNCTION notify_chat_participants()
RETURNS TRIGGER AS $$
DECLARE
  participant RECORD;
BEGIN
  -- Buscar todos los participantes de esta conversación EXCEPTO el remitente
  FOR participant IN
    SELECT cp.user_id 
    FROM conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id != NEW.user_id
  LOOP
    -- Solo insertar si el usuario es un empleado activo
    IF EXISTS (
      SELECT 1 FROM employees 
      WHERE auth_user_id = participant.user_id 
      AND is_active = true
    ) THEN
      INSERT INTO notifications (user_id, type, title, message, data, is_read)
      VALUES (
        participant.user_id,
        'chat_message',
        'Nuevo mensaje de ' || split_part(COALESCE(NEW.user_email, 'Usuario'), '@', 1),
        CASE 
          WHEN NEW.message_type = 'image' THEN '📷 Imagen adjunta'
          ELSE LEFT(COALESCE(NEW.content, ''), 100)
        END,
        jsonb_build_object('conversationId', NEW.conversation_id, 'messageId', NEW.id),
        false
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reemplazar trigger anterior
DROP TRIGGER IF EXISTS trigger_notify_admins_new_message ON messages;
DROP TRIGGER IF EXISTS trigger_notify_chat_participants ON messages;
CREATE TRIGGER trigger_notify_chat_participants
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_chat_participants();

-- =====================================================
-- PASO 3: Trigger que envía push via Edge Function cuando se inserta notificación
-- Usa pg_net (extensión de Supabase) para hacer HTTP POST a la Edge Function
-- =====================================================

-- Habilitar la extensión pg_net si no está activa
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION send_push_on_notification()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
  request_payload JSONB;
BEGIN
  -- Solo procesar notificaciones de chat (para no interferir con webhooks existentes de valet)
  IF NEW.type != 'chat_message' THEN
    RETURN NEW;
  END IF;

  -- Construir URL de la Edge Function
  edge_function_url := 'https://plblcxppezsfxwqgbnrn.supabase.co/functions/v1/send-push-notification';
  
  -- Obtener el service role key desde los secrets de vault (debe estar configurado)
  -- Alternativa: hardcodear temporalmente si vault no está disponible
  service_role_key := current_setting('supabase.service_role_key', true);
  
  -- Si no hay key en settings, intentar con el header de autorización estándar
  IF service_role_key IS NULL OR service_role_key = '' THEN
    -- Usar el service role key directamente (reemplazar si es necesario)
    service_role_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1);
  END IF;

  -- Construir payload idéntico al formato de webhook
  request_payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'notifications',
    'record', jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'type', NEW.type,
      'title', NEW.title,
      'message', NEW.message,
      'data', NEW.data,
      'is_read', NEW.is_read
    )
  );

  -- Enviar HTTP POST asíncrono a la Edge Function
  PERFORM extensions.http_post(
    edge_function_url,
    request_payload::text,
    'application/json'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- No bloquear la inserción si falla el push
    RAISE WARNING 'Push notification send failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_send_push_on_notification ON notifications;
CREATE TRIGGER trigger_send_push_on_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_push_on_notification();

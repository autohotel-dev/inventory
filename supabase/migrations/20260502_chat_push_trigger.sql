-- Migración para enviar notificaciones a los administradores cuando hay un nuevo mensaje de chat
-- Escucha la tabla `messages` e inserta en la tabla `notifications` para los admins.

CREATE OR REPLACE FUNCTION notify_admins_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
  admin_user RECORD;
BEGIN
  -- Ignorar si el mensaje fue enviado por un administrador (para no auto-notificar)
  -- Buscamos el rol del que envía el mensaje
  IF EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = NEW.user_id 
    AND role IN ('admin', 'manager', 'superuser')
  ) THEN
    -- Si es admin quien escribe, podríamos querer notificar a OTROS admins, 
    -- pero por ahora para evitar spam, o notificar a los no emisores:
    FOR admin_user IN 
      SELECT auth_user_id FROM employees 
      WHERE role IN ('admin', 'manager', 'superuser')
      AND auth_user_id != NEW.user_id
      AND is_active = true
      AND auth_user_id IS NOT NULL
    LOOP
      INSERT INTO notifications (user_id, type, title, message, data, is_read)
      VALUES (
        admin_user.auth_user_id,
        'chat_message',
        'Nuevo mensaje de ' || split_part(NEW.user_email, '@', 1),
        NEW.content,
        jsonb_build_object('conversationId', NEW.conversation_id, 'messageId', NEW.id),
        false
      );
    END LOOP;
    RETURN NEW;
  END IF;

  -- Si NO es admin quien escribe (ej. recepción, cocheros), notificar a TODOS los admins
  FOR admin_user IN 
    SELECT auth_user_id FROM employees 
    WHERE role IN ('admin', 'manager', 'superuser')
    AND is_active = true
    AND auth_user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data, is_read)
    VALUES (
      admin_user.auth_user_id,
      'chat_message',
      'Mensaje de ' || split_part(NEW.user_email, '@', 1),
      NEW.content,
      jsonb_build_object('conversationId', NEW.conversation_id, 'messageId', NEW.id),
      false
    );
  END LOOP;

  -- Opcionalmente emitir un pg_notify para integraciones externas
  PERFORM pg_notify('push_notification', jsonb_build_object(
    'type', 'CHAT_MESSAGE',
    'record', to_jsonb(NEW)
  )::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
DROP TRIGGER IF EXISTS trigger_notify_admins_new_message ON messages;
CREATE TRIGGER trigger_notify_admins_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_on_new_message();

-- ====================================================================
-- MIGRATION: Notificaciones Push para Camaristas
-- Description: Trigger para notificar a camaristas cuando una 
-- habitación cambia a SUCIA, usando la tabla de notificaciones.
-- ====================================================================

CREATE OR REPLACE FUNCTION notify_camaristas_on_dirty_room()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si el estado cambió a 'SUCIA'
  IF NEW.status = 'SUCIA' AND OLD.status != 'SUCIA' THEN
    
    -- Insertar notificación para cada camarista activa
    INSERT INTO public.notifications (user_id, employee_id, type, title, message, data, action_url)
    SELECT 
      e.auth_user_id,
      e.id,
      'system_alert', -- Usando uno de los tipos permitidos (system_alert)
      'Limpieza Requerida: Hab. ' || NEW.number,
      'La habitación ' || NEW.number || ' ha sido desocupada y requiere limpieza.',
      jsonb_build_object(
        'type', 'ROOM_DIRTY',
        'roomNumber', NEW.number,
        'roomId', NEW.id
      ),
      '/camarista'
    FROM public.employees e
    WHERE e.role IN ('camarista', 'recamarista', 'Camarista', 'Recamarista') 
      AND e.auth_user_id IS NOT NULL 
      AND e.is_active = true;
      
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar el trigger si existe
DROP TRIGGER IF EXISTS trigger_room_dirty_notification ON public.rooms;

-- Crear el trigger en la tabla rooms
CREATE TRIGGER trigger_room_dirty_notification
  AFTER UPDATE OF status ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION notify_camaristas_on_dirty_room();

-- Comentario descriptivo
COMMENT ON FUNCTION notify_camaristas_on_dirty_room IS 'Envía notificación push a camaristas cuando una habitación cambia a SUCIA.';

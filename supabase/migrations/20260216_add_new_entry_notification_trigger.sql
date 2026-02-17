-- =====================================================
-- ACTUALIZACIÓN: NOTIFICACIONES DE NUEVA ENTRADA (NEW_ENTRY)
-- =====================================================
-- Este script actualiza la función notify_cochero_event para incluir
-- notificaciones cuando se crea una nueva estancia (room_stays INSERT).
-- Esto asegura que TODOS los cocheros activos reciban la alerta,
-- igual que sucede con los consumos.
-- =====================================================

-- 0. Asegurar que NEW_ENTRY esté en los tipos permitidos (por si acaso)
DO $$ 
BEGIN
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      -- Tipos originales
      'stock_low', 'stock_critical', 'order_pending', 'payment_due', 
      'shift_started', 'shift_ended', 'system_alert', 'info',
      -- Nuevos tipos para Cocheros + NEW_ENTRY
      'NEW_EXTRA', 'NEW_CONSUMPTION', 'DAMAGE_REPORT', 'PROMO_4H', 'ROOM_CHANGE', 'NEW_ENTRY'
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint update skipped or failed: %', SQLERRM;
END $$;

-- 1. Actualizar la función principal
CREATE OR REPLACE FUNCTION notify_cochero_event()
RETURNS TRIGGER AS $$
DECLARE
  target_user_ids UUID[];
  notification_title TEXT;
  notification_body TEXT;
  notification_data JSONB;
  notification_type TEXT;
  
  -- Variables auxiliares
  room_num TEXT;
BEGIN
  -- Inicializar lista de destinatarios (Valets activos)
  -- Obtenemos los IDs de usuario de los empleados con sesión activa ('active')
  SELECT array_agg(DISTINCT auth_user_id) INTO target_user_ids
  FROM shift_sessions ss
  JOIN employees e ON ss.employee_id = e.id
  WHERE ss.status = 'active'
    AND e.role IN ('cochero', 'admin', 'valet') -- Incluimos 'valet' por consistencia
    AND e.auth_user_id IS NOT NULL;

  -- Si no hay valets activos, no hacemos nada
  IF target_user_ids IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lógica por tabla y eventos
  
  -- A) SALES ORDER ITEMS (Extras, Daños, Promos)
  IF TG_TABLE_NAME = 'sales_order_items' THEN
    -- Obtener número de habitación
    SELECT r.number INTO room_num
    FROM sales_orders so
    JOIN room_stays rs ON so.id = rs.sales_order_id
    JOIN rooms r ON rs.room_id = r.id
    WHERE so.id = NEW.sales_order_id
    LIMIT 1;
    
    room_num := COALESCE(room_num, '?');

    IF NEW.concept_type IN ('EXTRA_HOUR', 'EXTRA_PERSON') THEN
      notification_type := 'NEW_EXTRA';
      notification_title := 'Nueva ' || (CASE WHEN NEW.concept_type = 'EXTRA_HOUR' THEN 'Hora Extra' ELSE 'Persona Extra' END);
      notification_body := 'Habitación ' || room_num || ': Se ha registrado un cargo extra.';
      notification_data := jsonb_build_object(
        'type', 'NEW_EXTRA',
        'consumptionId', NEW.id,
        'salesOrderId', NEW.sales_order_id,
        'roomNumber', room_num,
        'stayId', (SELECT id FROM room_stays WHERE sales_order_id = NEW.sales_order_id LIMIT 1)
      );

    ELSIF NEW.concept_type IN ('CONSUMPTION', 'Minibar', 'Cafeteria', 'Cocina') THEN
      notification_type := 'NEW_CONSUMPTION';
      notification_title := 'Nuevo Consumo';
      notification_body := 'Habitación ' || room_num || ': Nuevo consumo registrado.';
      notification_data := jsonb_build_object(
        'type', 'NEW_CONSUMPTION',
        'consumptionId', NEW.id,
        'salesOrderId', NEW.sales_order_id,
        'roomNumber', room_num
      );
      
    ELSIF NEW.concept_type = 'DAMAGE_CHARGE' THEN
      notification_type := 'DAMAGE_REPORT';
      notification_title := '⚠️ Reporte de Daños';
      notification_body := 'Habitación ' || room_num || ': ' || LEFT(COALESCE(NEW.issue_description, 'Reporte de daño'), 50);
      notification_data := jsonb_build_object(
        'type', 'DAMAGE_REPORT',
        'consumptionId', NEW.id,
        'salesOrderId', NEW.sales_order_id,
        'roomNumber', room_num
      );
      
    ELSIF NEW.concept_type = 'PROMO_4H' THEN
      notification_type := 'PROMO_4H';
      notification_title := '⏳ Promoción 4 Horas';
      notification_body := 'Habitación ' || room_num || ' ha aplicado promoción de 4 horas.';
      notification_data := jsonb_build_object(
        'type', 'PROMO_4H',
        'consumptionId', NEW.id,
        'salesOrderId', NEW.sales_order_id,
        'roomNumber', room_num
      );
    END IF;

  -- B) ROOM STAYS (Nueva Entrada y Cambio de habitación)
  ELSIF TG_TABLE_NAME = 'room_stays' THEN
    
    -- CASO 1: Cambio de habitación (UPDATE)
    IF TG_OP = 'UPDATE' AND OLD.room_id IS DISTINCT FROM NEW.room_id THEN
      DECLARE
        old_room_num TEXT;
        new_room_num TEXT;
      BEGIN
        SELECT number INTO old_room_num FROM rooms WHERE id = OLD.room_id;
        SELECT number INTO new_room_num FROM rooms WHERE id = NEW.room_id;
        
        notification_type := 'ROOM_CHANGE';
        notification_title := 'Cambio de Habitación';
        notification_body := 'Cambio: Hab ' || COALESCE(old_room_num, '?') || ' ➡️ Hab ' || COALESCE(new_room_num, '?');
        notification_data := jsonb_build_object(
          'type', 'ROOM_CHANGE',
          'stayId', NEW.id,
          'oldRoomId', OLD.room_id,
          'newRoomId', NEW.room_id,
          'oldRoomNumber', old_room_num,
          'newRoomNumber', new_room_num
        );
      END;

    -- CASO 2: Nueva Entrada (INSERT)
    ELSIF TG_OP = 'INSERT' AND NEW.status = 'ACTIVA' THEN
      -- Obtener número de habitación
      SELECT number INTO room_num FROM rooms WHERE id = NEW.room_id;
      
      notification_type := 'NEW_ENTRY';
      notification_title := '🚗 Nueva Entrada';
      notification_body := 'Nueva estancia en Habitación ' || COALESCE(room_num, '?') || '. Acepta la entrada para registrar vehículo.';
      notification_data := jsonb_build_object(
        'type', 'NEW_ENTRY',
        'stayId', NEW.id,
        'roomId', NEW.room_id,
        'roomNumber', room_num
      );
    END IF;
  END IF;

  -- Solo insertar si se definió un tipo de notificación
  IF notification_type IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, data, type, created_at)
    SELECT 
      target_id,
      notification_title,
      notification_body,
      notification_data,
      notification_type,
      NOW()
    FROM unnest(target_user_ids) AS target_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear Trigger para ROOM_STAYS INSERT
-- Primero borramos el trigger anterior de update si existe para recrearlo o asegurar limpieza
DROP TRIGGER IF EXISTS trigger_notify_cochero_new_entry ON room_stays;

-- Creamos un trigger específico para INSERT que llame a la misma función centralizada
CREATE TRIGGER trigger_notify_cochero_new_entry
AFTER INSERT ON room_stays
FOR EACH ROW
WHEN (NEW.status = 'ACTIVA')
EXECUTE FUNCTION notify_cochero_event();

-- Nota: El trigger existing 'trigger_notify_cochero_room_change' maneja UPDATES, 
-- este nuevo trigger maneja INSERTS. Pueden coexistir sin problema.

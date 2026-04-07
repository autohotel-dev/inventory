-- =====================================================
-- DESACTIVAR NOTIFICACIÓN DE CONSUMOS EN EL TRIGGER
-- =====================================================
-- El trigger `notify_cochero_event()` envía una notificación por CADA item
-- insertado en sales_order_items con concept_type = 'CONSUMPTION'.
-- Esto causa N notificaciones duplicadas cuando se agregan N productos.
--
-- La notificación de consumos ahora se maneja desde la web app via
-- el RPC `send_valet_notification()`, que envía UNA SOLA notificación
-- consolidada con todos los productos y el saldo pendiente.
--
-- Este script actualiza la función para EXCLUIR consumos del trigger,
-- manteniendo las notificaciones de extras, daños y promos.
-- =====================================================

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
  SELECT array_agg(DISTINCT auth_user_id) INTO target_user_ids
  FROM shift_sessions ss
  JOIN employees e ON ss.employee_id = e.id
  WHERE ss.status = 'active'
    AND e.role IN ('cochero', 'admin', 'valet')
    AND e.auth_user_id IS NOT NULL;

  -- Si no hay valets activos, no hacemos nada
  IF target_user_ids IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lógica por tabla y eventos
  
  -- A) SALES ORDER ITEMS (Extras, Daños, Promos — YA NO CONSUMOS)
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

    -- CONSUMPTIONS: DESACTIVADO — manejado por RPC send_valet_notification()
    -- que envía UNA notificación consolidada con todos los productos.
    -- ELSIF NEW.concept_type IN ('CONSUMPTION', 'Minibar', 'Cafeteria', 'Cocina') THEN
    --   notification_type := 'NEW_CONSUMPTION';
    --   notification_title := 'Nuevo Consumo';
    --   notification_body := 'Habitación ' || room_num || ': Nuevo consumo registrado.';
      
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

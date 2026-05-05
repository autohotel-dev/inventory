-- Migration: Add Realtime Triggers for FastAPI WebSockets
-- Creates a generic function that sends a JSON payload to the 'luxor_realtime' channel
-- and attaches it to the critical tables.

-- 1. Create the generic notify function
CREATE OR REPLACE FUNCTION notify_realtime()
RETURNS trigger AS $$
DECLARE
  payload JSON;
BEGIN
  -- Construir el payload JSON emulando el formato de Supabase
  payload = json_build_object(
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'type', TG_OP,
    'record', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE null END,
    'old_record', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE null END,
    'commit_timestamp', current_timestamp
  );

  -- Emitir notificación al canal 'luxor_realtime'
  PERFORM pg_notify('luxor_realtime', payload::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop existing triggers if they exist (to allow idempotency)
DROP TRIGGER IF EXISTS trg_rooms_realtime ON rooms;
DROP TRIGGER IF EXISTS trg_room_assets_realtime ON room_assets;
DROP TRIGGER IF EXISTS trg_room_stays_realtime ON room_stays;
DROP TRIGGER IF EXISTS trg_payments_realtime ON payments;
DROP TRIGGER IF EXISTS trg_sales_orders_realtime ON sales_orders;
DROP TRIGGER IF EXISTS trg_sales_order_items_realtime ON sales_order_items;
DROP TRIGGER IF EXISTS trg_shift_sessions_realtime ON shift_sessions;
DROP TRIGGER IF EXISTS trg_audit_logs_realtime ON audit_logs;

-- 3. Attach trigger to tables
CREATE TRIGGER trg_rooms_realtime
AFTER INSERT OR UPDATE OR DELETE ON rooms
FOR EACH ROW EXECUTE FUNCTION notify_realtime();

CREATE TRIGGER trg_room_assets_realtime
AFTER INSERT OR UPDATE OR DELETE ON room_assets
FOR EACH ROW EXECUTE FUNCTION notify_realtime();

CREATE TRIGGER trg_room_stays_realtime
AFTER INSERT OR UPDATE OR DELETE ON room_stays
FOR EACH ROW EXECUTE FUNCTION notify_realtime();

CREATE TRIGGER trg_payments_realtime
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION notify_realtime();

CREATE TRIGGER trg_sales_orders_realtime
AFTER INSERT OR UPDATE OR DELETE ON sales_orders
FOR EACH ROW EXECUTE FUNCTION notify_realtime();

CREATE TRIGGER trg_sales_order_items_realtime
AFTER INSERT OR UPDATE OR DELETE ON sales_order_items
FOR EACH ROW EXECUTE FUNCTION notify_realtime();

CREATE TRIGGER trg_shift_sessions_realtime
AFTER INSERT OR UPDATE OR DELETE ON shift_sessions
FOR EACH ROW EXECUTE FUNCTION notify_realtime();

CREATE TRIGGER trg_audit_logs_realtime
AFTER INSERT OR UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION notify_realtime();

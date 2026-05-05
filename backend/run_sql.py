import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    sql = """
CREATE OR REPLACE FUNCTION notify_realtime()
RETURNS trigger AS $$
DECLARE
  payload JSON;
BEGIN
  payload = json_build_object(
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'type', TG_OP,
    'record', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE null END,
    'old_record', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE null END,
    'commit_timestamp', current_timestamp
  );
  PERFORM pg_notify('luxor_realtime', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_realtime ON messages;
CREATE TRIGGER trg_messages_realtime AFTER INSERT OR UPDATE OR DELETE ON messages FOR EACH ROW EXECUTE FUNCTION notify_realtime();
    """
    await conn.execute(sql)
    await conn.close()
    print("Done")

asyncio.run(main())

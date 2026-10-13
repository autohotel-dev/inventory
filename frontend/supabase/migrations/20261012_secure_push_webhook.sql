-- Edge Function send-push-notification (verify_jwt = false) aceptaba cualquier petición y mandaba
-- el texto recibido: cualquiera podía enviar push falsos a los empleados. El webhook ni siquiera
-- mandaba una clave real (el header tenía el texto de ejemplo "<tu SUPABASE_SERVICE_ROLE_KEY>").
-- Ahora el trigger manda un secreto compartido (x-push-secret) que la función valida, y la función
-- relee la notificación por id en vez de confiar en el body.
--
-- Al aplicar: reemplazar <PUSH_WEBHOOK_SECRET> por el mismo valor configurado en
-- Edge Functions → Secrets → PUSH_WEBHOOK_SECRET. NO subir el valor real a git.
-- Aplicado en producción el 2026-10-12 desde el SQL Editor.
BEGIN;
DROP TRIGGER IF EXISTS chat_push_notification ON public.notifications;
CREATE TRIGGER chat_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(
    'https://plblcxppezsfxwqgbnrn.supabase.co/functions/v1/send-push-notification',
    'POST',
    '{"Content-Type":"application/json","x-push-secret":"<PUSH_WEBHOOK_SECRET>"}',
    '{}',
    '5000'
  );

-- Versión vieja del mismo envío, sin trigger que la use (código muerto)
DROP FUNCTION IF EXISTS public.send_push_on_notification();
COMMIT;

-- Ninguna función de public debe poder ejecutarse SIN SESIÓN (rol anon / PUBLIC).
-- 122 de 125 funciones (61 SECURITY DEFINER, p. ej. cancel_item_with_refund, cancel_stay,
-- process_full_checkout) eran ejecutables con solo la clave pública que viaja en el POS.
-- Auditoría previa (2026-10-12): POS web y apps llaman siempre con sesión (580/580 POST en
-- logs como authenticated), cron jobs corren como postgres, Edge Functions usan service_role
-- y el portal de huéspedes no llama RPCs. Usuarios con sesión y service_role quedan igual.
-- Aplicado en producción el 2026-10-12 desde el SQL Editor.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
  END LOOP;
END $$;

-- Funciones futuras creadas por postgres: tampoco ejecutables sin sesión
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

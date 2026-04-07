-- =====================================================
-- FIX COMPLETO: Realtime + RLS para Dashboard de Habitaciones
-- =====================================================
-- El dashboard de habitaciones escucha cambios en:
--   rooms, room_stays, payments, sales_orders, sales_order_items, notifications
-- 
-- Todas deben estar en la publicación supabase_realtime
-- y tener políticas SELECT para usuarios autenticados.
-- =====================================================

-- =====================================================
-- 1. PUBLICACIÓN REALTIME - Agregar todas las tablas
-- =====================================================

DO $$
DECLARE
  tbl TEXT;
  tables_to_add TEXT[] := ARRAY['rooms', 'room_stays', 'payments', 'sales_orders', 'sales_order_items', 'notifications', 'employees', 'shift_sessions'];
BEGIN
  FOREACH tbl IN ARRAY tables_to_add LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
      RAISE NOTICE '✅ % agregada a supabase_realtime', tbl;
    ELSE
      RAISE NOTICE '⏭️ % ya estaba en supabase_realtime', tbl;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- 2. POLÍTICAS RLS - SELECT para authenticated
-- =====================================================
-- Asegurar que usuarios autenticados puedan leer las tablas
-- necesarias para el dashboard. Sin esto, Realtime no entrega eventos.
-- =====================================================

-- rooms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rooms' AND cmd = 'r'
    AND qual = 'true' AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    BEGIN
      CREATE POLICY "realtime_select_rooms" ON rooms FOR SELECT TO authenticated USING (true);
      RAISE NOTICE '✅ Política SELECT creada para rooms';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE '⏭️ Política SELECT ya existe para rooms';
    END;
  ELSE
    RAISE NOTICE '⏭️ Política SELECT ya existe para rooms';
  END IF;
END $$;

-- room_stays
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'room_stays' AND cmd = 'r'
    AND qual = 'true' AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    BEGIN
      CREATE POLICY "realtime_select_room_stays" ON room_stays FOR SELECT TO authenticated USING (true);
      RAISE NOTICE '✅ Política SELECT creada para room_stays';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE '⏭️ Política SELECT ya existe para room_stays';
    END;
  ELSE
    RAISE NOTICE '⏭️ Política SELECT ya existe para room_stays';
  END IF;
END $$;

-- payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND cmd = 'r'
    AND qual = 'true' AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    BEGIN
      CREATE POLICY "realtime_select_payments" ON payments FOR SELECT TO authenticated USING (true);
      RAISE NOTICE '✅ Política SELECT creada para payments';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE '⏭️ Política SELECT ya existe para payments';
    END;
  ELSE
    RAISE NOTICE '⏭️ Política SELECT ya existe para payments';
  END IF;
END $$;

-- sales_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sales_orders' AND cmd = 'r'
    AND qual = 'true' AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    BEGIN
      CREATE POLICY "realtime_select_sales_orders" ON sales_orders FOR SELECT TO authenticated USING (true);
      RAISE NOTICE '✅ Política SELECT creada para sales_orders';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE '⏭️ Política SELECT ya existe para sales_orders';
    END;
  ELSE
    RAISE NOTICE '⏭️ Política SELECT ya existe para sales_orders';
  END IF;
END $$;

-- sales_order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sales_order_items' AND cmd = 'r'
    AND qual = 'true' AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    BEGIN
      CREATE POLICY "realtime_select_sales_order_items" ON sales_order_items FOR SELECT TO authenticated USING (true);
      RAISE NOTICE '✅ Política SELECT creada para sales_order_items';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE '⏭️ Política SELECT ya existe para sales_order_items';
    END;
  ELSE
    RAISE NOTICE '⏭️ Política SELECT ya existe para sales_order_items';
  END IF;
END $$;

-- notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND cmd = 'r'
    AND qual = 'true' AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    BEGIN
      CREATE POLICY "realtime_select_notifications" ON notifications FOR SELECT TO authenticated USING (true);
      RAISE NOTICE '✅ Política SELECT creada para notifications';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE '⏭️ Política SELECT ya existe para notifications';
    END;
  ELSE
    RAISE NOTICE '⏭️ Política SELECT ya existe para notifications';
  END IF;
END $$;

-- employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND cmd = 'r'
    AND qual = 'true' AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    BEGIN
      CREATE POLICY "realtime_select_employees" ON employees FOR SELECT TO authenticated USING (true);
      RAISE NOTICE '✅ Política SELECT creada para employees';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE '⏭️ Política SELECT ya existe para employees';
    END;
  ELSE
    RAISE NOTICE '⏭️ Política SELECT ya existe para employees';
  END IF;
END $$;

-- shift_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'shift_sessions' AND cmd = 'r'
    AND qual = 'true' AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    BEGIN
      CREATE POLICY "realtime_select_shift_sessions" ON shift_sessions FOR SELECT TO authenticated USING (true);
      RAISE NOTICE '✅ Política SELECT creada para shift_sessions';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE '⏭️ Política SELECT ya existe para shift_sessions';
    END;
  ELSE
    RAISE NOTICE '⏭️ Política SELECT ya existe para shift_sessions';
  END IF;
END $$;

-- =====================================================
-- 3. VERIFICACIÓN - Listar tablas en la publicación
-- =====================================================
-- SELECT schemaname, tablename FROM pg_publication_tables 
-- WHERE pubname = 'supabase_realtime' ORDER BY tablename;

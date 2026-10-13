-- Turnos de recepción que quedaron "activos" después de registrar la salida, sin corte.
--
-- clockOut() (lib/services/shift-service.ts) guardaba clock_out_at sin cambiar el estado. Si la
-- recepcionista dejaba el corte "para después" o cerraba la ventana del corte, el turno quedaba
-- active + clock_out_at y el indicador de Cortes pendientes (que busca 'pending_closing') nunca
-- lo mostraba. Cobros de esos turnos (2026-10-12): Bridget 21-jul $8,375.00, Bridget 30-jul
-- $12,225.00, Patricia 5-ago $11,760.01, Fer 19-sep $35,895.00, Patricia 21-sep $0.
--
-- Se pasan a 'pending_closing' para que aparezcan en Cortes pendientes y administración decida
-- si hace el corte o cierra el turno con una nota. No se modifica ningún pago.
-- Aplicado en producción el 2026-10-13 desde el SQL Editor.
UPDATE public.shift_sessions
   SET status = 'pending_closing',
       notes  = concat_ws(E'\n', notes,
                 'Recuperado 2026-10-13: tenía salida registrada pero seguía activo sin corte (no aparecía en Cortes pendientes).')
 WHERE id IN (
     '55c91e1c-ac5f-4314-8b1e-ea178b30eb8e',  -- Bridget   2026-07-21
     '42e3299e-e5d3-4d2b-9e6c-fcf1651a4596',  -- Bridget   2026-07-30
     '6b7727a1-cf44-43ae-bb49-3fedd24b856c',  -- Patricia  2026-08-05
     '469514a1-15ef-41ce-b01e-33b0d94ce581',  -- Fer       2026-09-19
     '4df6b4e6-419e-4299-ac1f-7d8fd725f6ff'   -- Patricia  2026-09-21
   )
   AND status = 'active'
   AND clock_out_at IS NOT NULL;

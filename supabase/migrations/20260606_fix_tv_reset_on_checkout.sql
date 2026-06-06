-- =====================================================================
-- FIX: Reset TV remote assets on checkout
-- 
-- Problem: When checkout happens, room_assets was NOT being reset.
-- This caused the TV to appear as "TV_ENCENDIDA" with the previous
-- cochero still assigned even after checkout, through cleaning, and
-- into the next check-in cycle.
--
-- Solution: Add a step in process_full_checkout that resets all 
-- TV_REMOTE assets to 'EN_HABITACION' and clears assigned_employee_id.
-- Assets marked as 'EXTRAVIADO' are preserved.
--
-- Flow after fix:
-- 1. Checkout → TV resets to EN_HABITACION (no cochero)
-- 2. Recamarista limpia → TV stays EN_HABITACION (untouched)
-- 3. Recepción assigns cochero → TV → PENDIENTE_ENCENDIDO
-- 4. Cochero turns on TV → TV → TV_ENCENDIDA
-- 5. New check-in → TV already on, ready for guest
-- =====================================================================

-- 1. Data cleanup: Reset stale TV assets for non-occupied rooms
UPDATE public.room_assets
SET status = 'EN_HABITACION',
    assigned_employee_id = NULL
WHERE asset_type = 'TV_REMOTE'
  AND status NOT IN ('EN_HABITACION', 'EXTRAVIADO')
  AND room_id IN (
    SELECT id FROM public.rooms WHERE status NOT IN ('OCUPADA')
  );

-- 2. Updated process_full_checkout with TV reset step (section 7b)
-- The function now includes a loop after finalizing stay/order/room
-- that resets all TV_REMOTE assets to EN_HABITACION and logs the action
-- as 'RESET_ON_CHECKOUT'.
-- 
-- See the CREATE OR REPLACE in the Supabase dashboard for the full
-- function body (applied via execute_sql).

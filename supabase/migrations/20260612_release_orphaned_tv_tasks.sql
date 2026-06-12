-- ============================================================================
-- Migration: Release Orphaned TV Tasks on Shift Change
-- 
-- Problema: Cuando un cochero sale de turno sin confirmar las TVs asignadas,
-- los room_assets quedan en PENDIENTE_ENCENDIDO con su employee_id pero el
-- cochero ya no está en turno. La siguiente recepcionista no puede reasignar.
--
-- Solución:
-- 1. RPC release_orphaned_tv_tasks() — libera assets huérfanos
-- 2. RPC get_orphaned_tv_count()    — cuenta TVs bloqueadas para el badge
-- 3. Trigger en shift_sessions INSERT — liberación automática al abrir turno
-- ============================================================================

-- ─── 1. RPC: Liberar TVs Huérfanas ───────────────────────────────────────────
-- Regresa a EN_HABITACION todos los room_assets PENDIENTE_ENCENDIDO cuyo
-- cochero asignado ya NO tiene un shift_session activo.

CREATE OR REPLACE FUNCTION public.release_orphaned_tv_tasks(
    p_action_by_employee_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_released_count INT := 0;
    v_asset          RECORD;
    v_room_number    TEXT;
BEGIN
    -- Iterar sobre los assets huérfanos para poder loguear cada uno
    FOR v_asset IN
        SELECT
            ra.id        AS asset_id,
            ra.room_id,
            ra.status    AS current_status,
            ra.assigned_employee_id,
            r.number     AS room_number
        FROM public.room_assets ra
        LEFT JOIN public.rooms r ON r.id = ra.room_id
        WHERE ra.asset_type = 'TV_REMOTE'
          AND ra.status = 'PENDIENTE_ENCENDIDO'
          AND ra.assigned_employee_id IS NOT NULL
          AND NOT EXISTS (
              -- Cochero sin turno activo = huérfano
              SELECT 1
              FROM public.shift_sessions ss
              WHERE ss.employee_id = ra.assigned_employee_id
                AND ss.status = 'active'
                AND ss.clock_out_at IS NULL
          )
    LOOP
        -- Liberar el asset
        UPDATE public.room_assets
        SET status              = 'EN_HABITACION',
            assigned_employee_id = NULL,
            updated_at           = NOW()
        WHERE id = v_asset.asset_id;

        -- Registrar en auditoría
        INSERT INTO public.room_asset_logs (
            asset_id,
            previous_status,
            new_status,
            employee_id,
            action_type,
            assigned_to_employee_id,
            room_id,
            room_number,
            notes
        ) VALUES (
            v_asset.asset_id,
            v_asset.current_status,
            'EN_HABITACION',
            p_action_by_employee_id,
            'RELEASED_ORPHANED_SHIFT_CHANGE',
            v_asset.assigned_employee_id,   -- quién tenía la tarea (registro forense)
            v_asset.room_id,
            v_asset.room_number,
            'Liberado automáticamente por cambio de turno: cochero asignado ya no está en turno.'
        );

        v_released_count := v_released_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success',         true,
        'released_count',  v_released_count,
        'message',         CASE
                               WHEN v_released_count = 0
                               THEN 'No había TVs huérfanas pendientes.'
                               ELSE format('%s TV(s) liberada(s) para reasignación.', v_released_count)
                           END
    );
END;
$$;

-- ─── 2. RPC: Contar TVs Huérfanas (para el badge de alerta) ──────────────────

CREATE OR REPLACE FUNCTION public.get_orphaned_tv_count()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM public.room_assets ra
    WHERE ra.asset_type = 'TV_REMOTE'
      AND ra.status = 'PENDIENTE_ENCENDIDO'
      AND ra.assigned_employee_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM public.shift_sessions ss
          WHERE ss.employee_id = ra.assigned_employee_id
            AND ss.status = 'active'
            AND ss.clock_out_at IS NULL
      );

    RETURN jsonb_build_object(
        'orphaned_count', v_count
    );
END;
$$;

-- ─── 3. Función del trigger de liberación automática ─────────────────────────

CREATE OR REPLACE FUNCTION public.trg_release_orphaned_tvs_on_shift_open()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Solo actuar cuando se abre un turno (INSERT con status = 'active')
    IF NEW.status = 'active' AND NEW.clock_out_at IS NULL THEN
        -- Liberar las TVs huérfanas del turno anterior
        -- El employee_id del nuevo turno actúa como "quién abrió turno"
        SELECT public.release_orphaned_tv_tasks(NEW.employee_id) INTO v_result;
    END IF;

    RETURN NEW;
END;
$$;

-- ─── 4. Crear el trigger en shift_sessions ────────────────────────────────────

DROP TRIGGER IF EXISTS trg_release_orphaned_tvs_on_shift_open ON public.shift_sessions;

CREATE TRIGGER trg_release_orphaned_tvs_on_shift_open
    AFTER INSERT ON public.shift_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_release_orphaned_tvs_on_shift_open();

-- ─── 5. Comentarios de documentación ─────────────────────────────────────────

COMMENT ON FUNCTION public.release_orphaned_tv_tasks IS
    'Libera room_assets de tipo TV_REMOTE en estado PENDIENTE_ENCENDIDO cuyo cochero asignado ya no tiene un shift_session activo. Registra cada liberación en room_asset_logs con action_type RELEASED_ORPHANED_SHIFT_CHANGE.';

COMMENT ON FUNCTION public.get_orphaned_tv_count IS
    'Retorna el conteo de TVs en PENDIENTE_ENCENDIDO cuyo cochero asignado ya no está en turno activo. Usado por el badge de alerta en recepción.';

COMMENT ON FUNCTION public.trg_release_orphaned_tvs_on_shift_open IS
    'Trigger automático: al abrir un nuevo turno (INSERT en shift_sessions con status=active), libera las TVs huérfanas del turno anterior.';

-- ─── 6. Limpieza inicial: aplicar liberación ahora mismo ─────────────────────
-- Ejecutar una vez para limpiar el estado actual antes de que el trigger esté activo

DO $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT public.release_orphaned_tv_tasks(NULL) INTO v_result;
    RAISE NOTICE 'Limpieza inicial de TVs huérfanas: %', v_result;
END;
$$;

-- ─── FIN ──────────────────────────────────────────────────────────────────────

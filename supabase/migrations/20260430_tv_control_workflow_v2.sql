-- Migration: TV Control Workflow V2
-- Purpose: Redesign the TV remote workflow. Remotes are now always in the room. Recepcion assigns a valet to turn on the TV.

-- 1. Reset all current remotes that are not 'EXTRAVIADO' to 'EN_HABITACION'
UPDATE public.room_assets
SET status = 'EN_HABITACION',
    assigned_employee_id = NULL
WHERE asset_type = 'TV_REMOTE' AND status IN ('EN_RECEPCION', 'CON_COCHERO');

-- 2. Update assign_asset_to_employee RPC
CREATE OR REPLACE FUNCTION public.assign_asset_to_employee(
    p_room_id UUID,
    p_asset_type TEXT,
    p_employee_id UUID,
    p_action_by_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asset_id UUID;
    v_current_status TEXT;
BEGIN
    -- Obtenemos o creamos el asset para esa habitación
    SELECT id, status INTO v_asset_id, v_current_status
    FROM public.room_assets
    WHERE room_id = p_room_id AND asset_type = p_asset_type;

    IF v_asset_id IS NULL THEN
        INSERT INTO public.room_assets (room_id, asset_type, status, assigned_employee_id)
        VALUES (p_room_id, p_asset_type, 'PENDIENTE_ENCENDIDO', p_employee_id)
        RETURNING id INTO v_asset_id;
        v_current_status := 'NO_EXISTIA';
    ELSE
        UPDATE public.room_assets
        SET status = 'PENDIENTE_ENCENDIDO',
            assigned_employee_id = p_employee_id
        WHERE id = v_asset_id;
    END IF;

    -- Registrar log
    INSERT INTO public.room_asset_logs (asset_id, previous_status, new_status, employee_id, action_type)
    VALUES (v_asset_id, v_current_status, 'PENDIENTE_ENCENDIDO', p_action_by_employee_id, 'ASSIGNED_TO_COCHERO_FOR_TV');

    RETURN jsonb_build_object('success', true, 'message', 'Cochero asignado exitosamente para encender TV');
END;
$$;

-- 3. Create confirm_tv_on RPC
CREATE OR REPLACE FUNCTION public.confirm_tv_on(
    p_room_id UUID,
    p_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asset_id UUID;
    v_current_status TEXT;
BEGIN
    SELECT id, status INTO v_asset_id, v_current_status
    FROM public.room_assets
    WHERE room_id = p_room_id AND asset_type = 'TV_REMOTE';

    IF v_asset_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Activo no encontrado para esta habitación');
    END IF;

    UPDATE public.room_assets
    SET status = 'TV_ENCENDIDA',
        assigned_employee_id = NULL
    WHERE id = v_asset_id;

    INSERT INTO public.room_asset_logs (asset_id, previous_status, new_status, employee_id, action_type)
    VALUES (v_asset_id, v_current_status, 'TV_ENCENDIDA', p_employee_id, 'CONFIRMED_TV_ON');

    RETURN jsonb_build_object('success', true, 'message', 'Televisión confirmada como encendida');
END;
$$;

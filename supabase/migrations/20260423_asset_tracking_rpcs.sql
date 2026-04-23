-- Migration: RPCs for Room Assets Tracking

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
        VALUES (p_room_id, p_asset_type, 'CON_COCHERO', p_employee_id)
        RETURNING id INTO v_asset_id;
        v_current_status := 'NO_EXISTIA';
    ELSE
        UPDATE public.room_assets
        SET status = 'CON_COCHERO',
            assigned_employee_id = p_employee_id
        WHERE id = v_asset_id;
    END IF;

    -- Registrar log
    INSERT INTO public.room_asset_logs (asset_id, previous_status, new_status, employee_id, action_type)
    VALUES (v_asset_id, v_current_status, 'CON_COCHERO', p_action_by_employee_id, 'ASSIGNED_TO_COCHERO');

    RETURN jsonb_build_object('success', true, 'message', 'Control asignado exitosamente al cochero');
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_asset_in_room(
    p_room_id UUID,
    p_asset_type TEXT,
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
    WHERE room_id = p_room_id AND asset_type = p_asset_type;

    IF v_asset_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Activo no encontrado para esta habitación');
    END IF;

    UPDATE public.room_assets
    SET status = 'EN_HABITACION',
        assigned_employee_id = NULL
    WHERE id = v_asset_id;

    INSERT INTO public.room_asset_logs (asset_id, previous_status, new_status, employee_id, action_type)
    VALUES (v_asset_id, v_current_status, 'EN_HABITACION', p_employee_id, 'DROPPED_IN_ROOM');

    RETURN jsonb_build_object('success', true, 'message', 'Control marcado como presente en habitación');
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_asset_presence(
    p_room_id UUID,
    p_asset_type TEXT,
    p_is_present BOOLEAN,
    p_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asset_id UUID;
    v_current_status TEXT;
    v_new_status TEXT;
    v_action_type TEXT;
BEGIN
    SELECT id, status INTO v_asset_id, v_current_status
    FROM public.room_assets
    WHERE room_id = p_room_id AND asset_type = p_asset_type;

    IF v_asset_id IS NULL THEN
        -- Si no existe pero se marca como presente, lo creamos
        IF p_is_present THEN
            INSERT INTO public.room_assets (room_id, asset_type, status)
            VALUES (p_room_id, p_asset_type, 'EN_HABITACION')
            RETURNING id INTO v_asset_id;
            v_current_status := 'NO_EXISTIA';
        ELSE
            -- No existe y no está, lo creamos como EXTRAVIADO
            INSERT INTO public.room_assets (room_id, asset_type, status)
            VALUES (p_room_id, p_asset_type, 'EXTRAVIADO')
            RETURNING id INTO v_asset_id;
            v_current_status := 'NO_EXISTIA';
        END IF;
    END IF;

    IF p_is_present THEN
        v_new_status := 'EN_HABITACION';
        v_action_type := 'VERIFIED_IN_ROOM';
    ELSE
        v_new_status := 'EXTRAVIADO';
        v_action_type := 'MARKED_MISSING';
    END IF;

    UPDATE public.room_assets
    SET status = v_new_status,
        assigned_employee_id = NULL
    WHERE id = v_asset_id;

    INSERT INTO public.room_asset_logs (asset_id, previous_status, new_status, employee_id, action_type)
    VALUES (v_asset_id, v_current_status, v_new_status, p_employee_id, v_action_type);

    RETURN jsonb_build_object('success', true, 'message', 'Estado del control actualizado en limpieza');
END;
$$;

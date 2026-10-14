import { supabase } from './supabase';

/**
 * Cierra los turnos abiertos del empleado de la sesión al cerrar sesión en la app.
 *
 * Usa la función de la base close_my_open_shifts(), que identifica al empleado por su sesión
 * (no depende del estado local de la app, que puede estar desactualizado) y solo actúa para
 * cochero/camarista. Si la función no existiera (base sin migrar), cae al cierre directo.
 * Nunca lanza: cerrar sesión no debe bloquearse porque falle el cierre de turno.
 */
export async function closeMyOpenShifts(employeeId?: string | null): Promise<void> {
    try {
        const { data, error } = await supabase.rpc('close_my_open_shifts');
        if (!error && data?.success) {
            console.log(`[Logout] Turnos cerrados: ${data.closed ?? 0}`);
            return;
        }
        console.warn('[Logout] close_my_open_shifts no disponible, cierre directo:', error?.message || data?.error);

        if (!employeeId) return;
        const { error: updateError } = await supabase
            .from('shift_sessions')
            .update({ clock_out_at: new Date().toISOString(), status: 'closed' })
            .eq('employee_id', employeeId)
            .in('status', ['active', 'open']);
        if (updateError) console.error('[Logout] Error cerrando turno:', updateError);
    } catch (error) {
        console.error('[Logout] Error cerrando turno:', error);
    }
}

export interface ShiftDefinition {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    crosses_midnight: boolean;
}

/** Turno (Mañana, Tarde, Noche…) que corresponde a la hora actual del teléfono */
export async function getCurrentShiftDefinition(): Promise<ShiftDefinition | null> {
    const { data: shifts } = await supabase
        .from('shift_definitions')
        .select('id, name, start_time, end_time, crosses_midnight')
        .eq('is_active', true);
    if (!shifts?.length) return null;

    const currentTime = new Date().toTimeString().slice(0, 8);
    return (shifts as ShiftDefinition[]).find((s) =>
        s.crosses_midnight
            ? currentTime >= s.start_time || currentTime < s.end_time
            : currentTime >= s.start_time && currentTime < s.end_time
    ) || null;
}

/** Abre el turno del empleado. Devuelve un mensaje de error listo para mostrar, o null si se abrió. */
export async function startMyShift(employeeId: string, shiftDefinitionId: string): Promise<string | null> {
    const { error } = await supabase.from('shift_sessions').insert({
        employee_id: employeeId,
        shift_definition_id: shiftDefinitionId,
        clock_in_at: new Date().toISOString(),
        status: 'active',
    });
    if (!error) return null;
    const message = error.message || '';
    if (message.includes('ROLE_SHIFT_LIMIT_EXCEEDED')) {
        return 'Ya está lleno el cupo de turnos activos para tu rol. Pide a recepción que cierre el turno anterior.';
    }
    return message || 'No se pudo iniciar el turno';
}

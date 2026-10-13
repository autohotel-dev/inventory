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

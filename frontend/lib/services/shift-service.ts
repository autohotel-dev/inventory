/**
 * Servicio para operaciones relacionadas con turnos (shift sessions, closings, definitions)
 * Centraliza todas las queries de Supabase para el dominio de turnos.
 * 
 * Usado por: use-shift-closing, use-shift-manager, use-receptionist-dashboard,
 *            use-shift-closing-history, use-reprint-center
 */
import { createClient } from "@/lib/supabase/client";
import { Result, success, failure } from "@/lib/types/api";
import { logger } from "@/lib/utils/logger";
import { logAudit } from "@/lib/audit-logger";

// ─── Types ───────────────────────────────────────────────────────────

export interface ShiftSession {
    id: string;
    employee_id: string;
    shift_definition_id: string;
    schedule_id?: string | null;
    clock_in_at: string;
    clock_out_at: string | null;
    status: "active" | "pending_closing" | "closed" | "cancelled";
    notes: string | null;
    created_at?: string;
    employees?: any;
    shift_definitions?: any;
}

export interface ShiftDefinition {
    id: string;
    name: string;
    code: string;
    start_time: string;
    end_time: string;
    crosses_midnight: boolean;
    color: string;
    is_active: boolean;
    created_at: string;
}

export interface ShiftClosing {
    id: string;
    shift_session_id: string;
    employee_id: string;
    shift_definition_id: string;
    period_start: string;
    period_end: string;
    total_cash: number;
    total_card_bbva: number;
    total_card_getnet: number;
    total_sales: number;
    total_transactions: number;
    total_expenses: number;
    status: string;
    notes: string | null;
    created_at: string;
}

export interface ShiftClosingInsert {
    shift_session_id: string;
    employee_id: string;
    shift_definition_id: string;
    period_start: string;
    period_end: string;
    total_cash: number;
    total_card_bbva: number;
    total_card_getnet: number;
    total_sales: number;
    total_transactions: number;
    total_expenses: number;
    expenses_count: number;
    counted_cash: number;
    cash_difference: number;
    declared_card_bbva: number;
    declared_card_getnet: number;
    card_difference_bbva: number;
    card_difference_getnet: number;
    cash_breakdown: any;
    notes: string | null;
    status: string;
}

export interface ShiftClosingDetail {
    shift_closing_id: string;
    payment_id: string;
    sales_order_id: string;
    amount: number;
    payment_method: string;
    terminal_code: string | null;
}

// ─── Queries ─────────────────────────────────────────────────────────

/**
 * Obtiene todas las definiciones de turno activas
 */
export async function getActiveShiftDefinitions(): Promise<Result<ShiftDefinition[]>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("shift_definitions")
            .select("*")
            .eq("is_active", true)
            .order("start_time");

        if (error) {
            logger.error("Error fetching shift definitions", { error });
            return failure("No se pudieron cargar los turnos", "SHIFT_DEF_FETCH_ERROR");
        }
        return success(data || []);
    } catch (error) {
        logger.error("Unexpected error fetching shift definitions", error);
        return failure("Error inesperado al cargar turnos", "SHIFT_DEF_FETCH_EXCEPTION");
    }
}

/**
 * Obtiene la sesión activa de un empleado
 */
export async function getActiveSession(
    employeeId?: string
): Promise<Result<ShiftSession | null>> {
    const supabase = createClient();
    try {
        let query = supabase
            .from("shift_sessions")
            .select("*, employees(*), shift_definitions(*)")
            .eq("status", "active")
            .is("clock_out_at", null)
            .order("clock_in_at", { ascending: false })
            .limit(1);

        if (employeeId) {
            query = query.eq("employee_id", employeeId);
        }

        const { data, error } = await query;

        if (error) {
            logger.error("Error fetching active session", { employeeId, error });
            return failure("No se pudo obtener la sesión activa", "SESSION_FETCH_ERROR");
        }
        return success(data?.[0] || null);
    } catch (error) {
        logger.error("Unexpected error fetching active session", error);
        return failure("Error inesperado al obtener sesión", "SESSION_FETCH_EXCEPTION");
    }
}

/**
 * Obtiene todas las sesiones activas
 */
export async function getAllActiveSessions(): Promise<Result<ShiftSession[]>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("shift_sessions")
            .select("*, employees(*), shift_definitions(*)")
            .eq("status", "active")
            .is("clock_out_at", null)
            .order("clock_in_at", { ascending: false });

        if (error) {
            logger.error("Error fetching all active sessions", { error });
            return failure("No se pudieron cargar las sesiones activas", "SESSIONS_FETCH_ERROR");
        }
        return success(data || []);
    } catch (error) {
        logger.error("Unexpected error fetching sessions", error);
        return failure("Error inesperado al cargar sesiones", "SESSIONS_FETCH_EXCEPTION");
    }
}

/**
 * Abre una nueva sesión de turno (clock in)
 */
export async function clockIn(
    employeeId: string,
    shiftDefinitionId: string,
    pinCode?: string
): Promise<Result<ShiftSession>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("shift_sessions")
            .insert({
                employee_id: employeeId,
                shift_definition_id: shiftDefinitionId,
                clock_in_at: new Date().toISOString(),
                status: "active",
            })
            .select("*, employees(*), shift_definitions(*)")
            .single();

        if (error) {
            logger.error("Error creating shift session", { employeeId, error });
            return failure("No se pudo registrar la entrada", "CLOCK_IN_ERROR");
        }

        logAudit("INSERT", {
            tableName: "shift_sessions",
            recordId: data.id,
            description: `Entrada de turno registrada`,
        });
        return success(data);
    } catch (error) {
        logger.error("Unexpected error during clock in", error);
        return failure("Error inesperado al registrar entrada", "CLOCK_IN_EXCEPTION");
    }
}

/**
 * Cierra una sesión de turno (clock out)
 */
export async function clockOut(sessionId: string): Promise<Result<boolean>> {
    const supabase = createClient();
    try {
        const { error } = await supabase
            .from("shift_sessions")
            .update({
                clock_out_at: new Date().toISOString(),
            })
            .eq("id", sessionId);

        if (error) {
            logger.error("Error clocking out", { sessionId, error });
            return failure("No se pudo registrar la salida", "CLOCK_OUT_ERROR");
        }

        logAudit("UPDATE", {
            tableName: "shift_sessions",
            recordId: sessionId,
            description: "Salida de turno registrada",
        });
        return success(true);
    } catch (error) {
        logger.error("Unexpected error during clock out", error);
        return failure("Error inesperado al registrar salida", "CLOCK_OUT_EXCEPTION");
    }
}

/**
 * Cierra la sesión completamente (status = closed, sin corte)
 */
export async function closeSessionWithoutClosing(
    sessionId: string,
    additionalNotes?: string
): Promise<Result<boolean>> {
    const supabase = createClient();
    try {
        const { data: session } = await supabase
            .from("shift_sessions")
            .select("notes")
            .eq("id", sessionId)
            .single();

        const newNotes = session?.notes
            ? `${session.notes}\n${additionalNotes || "Turno cerrado sin transacciones."}`
            : additionalNotes || "Turno cerrado sin transacciones.";

        const { error } = await supabase
            .from("shift_sessions")
            .update({ status: "closed", notes: newNotes })
            .eq("id", sessionId);

        if (error) {
            logger.error("Error closing session", { sessionId, error });
            return failure("No se pudo cerrar el turno", "SESSION_CLOSE_ERROR");
        }
        return success(true);
    } catch (error) {
        logger.error("Unexpected error closing session", error);
        return failure("Error inesperado al cerrar turno", "SESSION_CLOSE_EXCEPTION");
    }
}

/**
 * Obtiene el resumen de pagos para cierre via RPC
 */
export async function getShiftClosingSummary(
    sessionId: string,
    employeeId: string
): Promise<Result<any>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase.rpc("get_shift_closing_summary", {
            p_session_id: sessionId,
            p_employee_id: employeeId,
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        return success(data);
    } catch (error) {
        logger.error("Error loading shift closing summary", { sessionId, error });
        return failure("No se pudo cargar el resumen de pagos", "CLOSING_SUMMARY_ERROR");
    }
}

/**
 * Verifica si ya existe un corte para esta sesión
 */
export async function getExistingClosing(
    sessionId: string
): Promise<Result<ShiftClosing | null>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("shift_closings")
            .select("*")
            .eq("shift_session_id", sessionId)
            .maybeSingle();

        if (error) {
            logger.error("Error checking existing closing", { sessionId, error });
            return failure("Error al verificar corte existente", "CLOSING_CHECK_ERROR");
        }
        return success(data);
    } catch (error) {
        logger.error("Unexpected error checking closing", error);
        return failure("Error inesperado", "CLOSING_CHECK_EXCEPTION");
    }
}

/**
 * Crea un nuevo corte de caja
 */
export async function createClosing(
    data: ShiftClosingInsert
): Promise<Result<ShiftClosing>> {
    const supabase = createClient();
    try {
        const { data: closing, error } = await supabase
            .from("shift_closings")
            .insert(data)
            .select()
            .single();

        if (error) {
            logger.error("Error creating closing", { error });
            return failure("No se pudo crear el corte de caja", "CLOSING_CREATE_ERROR");
        }

        logAudit("INSERT", {
            tableName: "shift_closings",
            recordId: closing.id,
            description: "Corte de caja creado",
        });
        return success(closing);
    } catch (error) {
        logger.error("Unexpected error creating closing", error);
        return failure("Error inesperado al crear corte", "CLOSING_CREATE_EXCEPTION");
    }
}

/**
 * Inserta detalles de cierre (pagos asociados)
 */
export async function insertClosingDetails(
    details: ShiftClosingDetail[]
): Promise<Result<boolean>> {
    const supabase = createClient();
    try {
        const { error } = await supabase
            .from("shift_closing_details")
            .insert(details);

        if (error) {
            logger.error("Error inserting closing details", { error });
            return failure("Error al guardar detalles del corte", "CLOSING_DETAILS_ERROR");
        }
        return success(true);
    } catch (error) {
        logger.error("Unexpected error inserting details", error);
        return failure("Error inesperado", "CLOSING_DETAILS_EXCEPTION");
    }
}

/**
 * Obtiene cargos a empleados de una sesión
 */
export async function getEmployeeCharges(sessionId: string): Promise<Result<any[]>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("shift_employee_charges")
            .select(`
                id, charge_type, description, unit_price, quantity, subtotal,
                discount_type, discount_value, discount_amount, total,
                payment_method, notes, created_at,
                charged_employee:charged_to(first_name, last_name, role)
            `)
            .eq("shift_session_id", sessionId)
            .neq("status", "rejected")
            .order("created_at", { ascending: true });

        if (error) {
            logger.error("Error fetching employee charges", { sessionId, error });
            return failure("Error al cargar cargos de empleados", "CHARGES_FETCH_ERROR");
        }
        return success(data || []);
    } catch (error) {
        logger.error("Unexpected error fetching charges", error);
        return failure("Error inesperado", "CHARGES_FETCH_EXCEPTION");
    }
}

/**
 * Obtiene gastos de una sesión de turno
 */
export async function getShiftExpenses(sessionId: string): Promise<Result<any[]>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("shift_expenses")
            .select("*")
            .eq("shift_session_id", sessionId)
            .neq("status", "rejected")
            .order("created_at", { ascending: true });

        if (error) {
            logger.error("Error fetching shift expenses", { sessionId, error });
            return failure("Error al cargar gastos", "EXPENSES_FETCH_ERROR");
        }
        return success(data || []);
    } catch (error) {
        logger.error("Unexpected error fetching expenses", error);
        return failure("Error inesperado", "EXPENSES_FETCH_EXCEPTION");
    }
}

/**
 * Crea un gasto de turno
 */
export async function createShiftExpense(expense: {
    shift_session_id: string;
    expense_type: string;
    amount: number;
    description: string;
    recipient?: string;
}): Promise<Result<any>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("shift_expenses")
            .insert(expense)
            .select()
            .single();

        if (error) {
            logger.error("Error creating expense", { error });
            return failure("No se pudo registrar el gasto", "EXPENSE_CREATE_ERROR");
        }

        logAudit("INSERT", {
            tableName: "shift_expenses",
            recordId: data.id,
            description: `Gasto registrado: ${expense.expense_type} - $${expense.amount}`,
        });
        return success(data);
    } catch (error) {
        logger.error("Unexpected error creating expense", error);
        return failure("Error inesperado al registrar gasto", "EXPENSE_CREATE_EXCEPTION");
    }
}

/**
 * Cierra sesión y marca como cerrado después de crear corte
 */
export async function closeSession(sessionId: string): Promise<Result<boolean>> {
    const supabase = createClient();
    try {
        const { error } = await supabase
            .from("shift_sessions")
            .update({ status: "closed" })
            .eq("id", sessionId);

        if (error) {
            logger.error("Error closing session after closing", { sessionId, error });
            return failure("No se pudo cerrar la sesión", "SESSION_CLOSE_ERROR");
        }
        return success(true);
    } catch (error) {
        logger.error("Unexpected error closing session", error);
        return failure("Error inesperado", "SESSION_CLOSE_EXCEPTION");
    }
}

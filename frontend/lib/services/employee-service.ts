/**
 * Servicio para operaciones relacionadas con empleados
 * Centraliza queries comunes de la tabla employees.
 * 
 * Usado por: use-shift-manager, use-receptionist-dashboard,
 *            use-employee-audit, components/employees/*
 */
import { createClient } from "@/lib/supabase/client";
import { Result, success, failure } from "@/lib/types/api";
import { logger } from "@/lib/utils/logger";

// ─── Types ───────────────────────────────────────────────────────────

export interface Employee {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
    is_active: boolean;
    auth_user_id: string | null;
    pin_code: string | null;
    created_at: string;
}

export type EmployeeRole =
    | "receptionist"
    | "manager"
    | "cochero"
    | "camarista"
    | "mantenimiento"
    | "admin";

/** Roles allowed for shift-based operations */
export const SHIFT_ROLES: EmployeeRole[] = [
    "receptionist", "manager", "cochero", "camarista", "mantenimiento",
];

// ─── Queries ─────────────────────────────────────────────────────────

/**
 * Obtiene todos los empleados activos, opcionalmente filtrados por roles
 */
export async function getActiveEmployees(
    roles?: EmployeeRole[]
): Promise<Result<Employee[]>> {
    const supabase = createClient();
    try {
        let query = supabase
            .from("employees")
            .select("*")
            .eq("is_active", true)
            .order("first_name");

        if (roles && roles.length > 0) {
            query = query.in("role", roles);
        }

        const { data, error } = await query;
        if (error) {
            logger.error("Error fetching active employees", { roles, error });
            return failure("No se pudieron cargar los empleados", "EMPLOYEES_FETCH_ERROR");
        }
        return success((data || []) as Employee[]);
    } catch (error) {
        logger.error("Unexpected error fetching employees", error);
        return failure("Error inesperado", "EMPLOYEES_FETCH_EXCEPTION");
    }
}

/**
 * Obtiene un empleado por su auth_user_id (para vincular sesión auth → empleado)
 */
export async function getEmployeeByAuthUserId(
    authUserId: string
): Promise<Result<Employee | null>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("employees")
            .select("*")
            .eq("auth_user_id", authUserId)
            .maybeSingle();

        if (error) {
            logger.error("Error fetching employee by auth user", { authUserId, error });
            return failure("No se pudo obtener el empleado", "EMPLOYEE_FETCH_ERROR");
        }
        return success(data as Employee | null);
    } catch (error) {
        logger.error("Unexpected error", error);
        return failure("Error inesperado", "EMPLOYEE_FETCH_EXCEPTION");
    }
}

/**
 * Obtiene el rol de un empleado por auth_user_id
 */
export async function getEmployeeRole(
    authUserId: string
): Promise<Result<string | null>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("employees")
            .select("role")
            .eq("auth_user_id", authUserId)
            .single();

        if (error) {
            logger.error("Error fetching employee role", { authUserId, error });
            return failure("No se pudo obtener el rol", "ROLE_FETCH_ERROR");
        }
        return success(data?.role || null);
    } catch (error) {
        logger.error("Unexpected error", error);
        return failure("Error inesperado", "ROLE_FETCH_EXCEPTION");
    }
}

/**
 * Verifica el PIN de un empleado
 */
export async function verifyEmployeePin(
    employeeId: string,
    pin: string
): Promise<Result<boolean>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("employees")
            .select("pin_code")
            .eq("id", employeeId)
            .single();

        if (error) {
            logger.error("Error verifying pin", { employeeId, error });
            return failure("Error al verificar PIN", "PIN_VERIFY_ERROR");
        }

        return success(data?.pin_code === pin);
    } catch (error) {
        logger.error("Unexpected error verifying pin", error);
        return failure("Error inesperado", "PIN_VERIFY_EXCEPTION");
    }
}

/**
 * Obtiene el nombre completo de un empleado
 */
export async function getEmployeeName(employeeId: string): Promise<Result<string>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("employees")
            .select("first_name, last_name")
            .eq("id", employeeId)
            .single();

        if (error) {
            logger.error("Error fetching employee name", { employeeId, error });
            return failure("No se pudo obtener el nombre", "NAME_FETCH_ERROR");
        }

        return success(`${data.first_name} ${data.last_name}`.trim());
    } catch (error) {
        logger.error("Unexpected error", error);
        return failure("Error inesperado", "NAME_FETCH_EXCEPTION");
    }
}

/**
 * Actualiza el PIN de un empleado
 */
export async function updateEmployeePin(
    employeeId: string,
    newPin: string
): Promise<Result<boolean>> {
    const supabase = createClient();
    try {
        const { error } = await supabase
            .from("employees")
            .update({ pin_code: newPin })
            .eq("id", employeeId);

        if (error) {
            logger.error("Error updating pin", { employeeId, error });
            return failure("No se pudo actualizar el PIN", "PIN_UPDATE_ERROR");
        }
        return success(true);
    } catch (error) {
        logger.error("Unexpected error updating pin", error);
        return failure("Error inesperado", "PIN_UPDATE_EXCEPTION");
    }
}

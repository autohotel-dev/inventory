/**
 * Tipos para respuestas de API y resultados de operaciones
 */

/**
 * Resultado exitoso de una operación
 */
export interface Success<T> {
    success: true;
    data: T;
}

/**
 * Resultado fallido de una operación
 */
export interface Failure {
    success: false;
    error: string;
    code?: string;
}

/**
 * Tipo genérico para resultados de operaciones
 * Permite manejar errores de forma type-safe
 * 
 * @example
 * const result: Result<User> = await getUser(id);
 * if (result.success) {
 *   console.log(result.data.name);
 * } else {
 *   console.error(result.error);
 * }
 */
export type Result<T> = Success<T> | Failure;

/**
 * Información de paginación
 */
export interface PaginationInfo {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

/**
 * Resultado paginado
 */
export interface PaginatedResult<T> {
    items: T[];
    pagination: PaginationInfo;
}

/**
 * Estado de un formulario
 */
export interface FormState<T> {
    data: T;
    errors: Partial<Record<keyof T, string>>;
    isSubmitting: boolean;
    isValid: boolean;
    isDirty: boolean;
}

/**
 * Respuesta de API con metadata
 */
export interface ApiResponse<T> {
    data: T;
    message?: string;
    timestamp: string;
}

/**
 * Error de API estructurado
 */
export interface ApiError {
    message: string;
    code: string;
    details?: Record<string, unknown>;
    timestamp: string;
}

/**
 * Opciones para queries
 */
export interface QueryOptions {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filters?: Record<string, unknown>;
}

/**
 * Helper para crear un resultado exitoso
 */
export function success<T>(data: T): Success<T> {
    return { success: true, data };
}

/**
 * Helper para crear un resultado fallido
 */
export function failure(error: string, code?: string): Failure {
    return { success: false, error, code };
}

/**
 * Helper para verificar si un resultado es exitoso
 */
export function isSuccess<T>(result: Result<T>): result is Success<T> {
    return result.success === true;
}

/**
 * Helper para verificar si un resultado es fallido
 */
export function isFailure<T>(result: Result<T>): result is Failure {
    return result.success === false;
}

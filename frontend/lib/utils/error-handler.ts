// Error handler utilities

/**
 * FIX #10: Better error messages
 * Converts various error types into user-friendly messages
 */
export interface ErrorInfo {
    title: string;
    description: string;
}

export function getErrorMessage(error: any): ErrorInfo {
    // Handle null/undefined
    if (!error) {
        return {
            title: "Error desconocido",
            description: "Ocurrió un error inesperado."
        };
    }

    // PostgreSQL error codes
    if (error?.code) {
        switch (error.code) {
            case '23505': // Unique violation
                return {
                    title: "Registro duplicado",
                    description: "Este elemento ya existe en la base de datos."
                };

            case '23503': // Foreign key violation
                return {
                    title: "Referencia inválida",
                    description: "No se puede eliminar porque está siendo usado en otro lugar."
                };

            case '23502': // Not null violation
                return {
                    title: "Campo requerido faltante",
                    description: "Uno o más campos obligatorios no fueron proporcionados."
                };

            case 'PGRST116': // Row not found
                return {
                    title: "No encontrado",
                    description: "El elemento solicitado no existe o fue eliminado."
                };

            case 'PGRST200': // Generic PostgreSQL error
                return {
                    title: "Error de base de datos",
                    description: error.message || "Error al procesar la solicitud."
                };

            case '42501': // Insufficient privilege
                return {
                    title: "Acceso denegado",
                    description: "No tienes permisos para realizar esta acción."
                };

            case '42P01': // Undefined table
                return {
                    title: "Error de configuración",
                    description: "Tabla no encontrada. Contacta al administrador."
                };

            default:
                return {
                    title: "Error de base de datos",
                    description: `Código ${error.code}: ${error.message || "Error desconocido"}`
                };
        }
    }

    // Network/Fetch errors
    if (error?.message?.toLowerCase().includes('fetch')) {
        return {
            title: "Error de conexión",
            description: "Verifica tu conexión a internet e intenta nuevamente."
        };
    }

    if (error?.message?.toLowerCase().includes('network')) {
        return {
            title: "Error de red",
            description: "No se pudo conectar al servidor. Revisa tu conexión."
        };
    }

    // Timeout errors
    if (error?.message?.toLowerCase().includes('timeout')) {
        return {
            title: "Tiempo de espera agotado",
            description: "La operación tardó demasiado. Intenta nuevamente."
        };
    }

    // Auth errors
    if (error?.message?.toLowerCase().includes('auth') || error?.message?.toLowerCase().includes('unauthorized')) {
        return {
            title: "No autorizado",
            description: "Tu sesión expiró. Por favor, inicia sesión nuevamente."
        };
    }

    // Validation errors
    if (error?.message?.toLowerCase().includes('invalid') || error?.message?.toLowerCase().includes('validation')) {
        return {
            title: "Datos inválidos",
            description: error.message || "Los datos proporcionados no son válidos."
        };
    }

    // Default fallback
    return {
        title: "Error",
        description: error?.message || error?.toString() || "Ocurrió un error inesperado."
    };
}

/**
 * Shorthand for logging error with context
 */
export function logError(context: string, error: any) {
    console.error(`[${context}]`, error);
    const { title, description } = getErrorMessage(error);
    console.error(`User-facing: ${title} - ${description}`);
}

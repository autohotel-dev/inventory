// utils/error-messages.ts
/**
 * Utility to get user-friendly error messages based on error type
 */

export function getShiftClosingErrorMessage(error: any): string {
    // Check if it's a network error
    if (!navigator.onLine) {
        return "Sin conexión a internet. Verifica tu conexión y vuelve a intentar";
    }

    // Handle Supabase/PostgreSQL error codes
    if (error.code) {
        switch (error.code) {
            case 'PGRST116':
                return "No se encontró el turno activo. Es posible que ya haya sido cerrado";

            case '23505': // Unique violation
                return "Ya existe un cierre para este turno. No se pueden crear cortes duplicados";

            case '23503': // Foreign key violation
                return "Error de integridad: algunos datos relacionados no se encontraron";

            case '42501': // Insufficient privilege
                return "No tienes permisos para realizar esta acción";

            case 'PGRST301': // Limit/offset requires order
                return "Error en la consulta de datos. Contacta al administrador";

            default:
                break;
        }
    }

    // Handle common HTTP errors
    if (error.status) {
        switch (error.status) {
            case 401:
                return "Sesión expirada. Por favor inicia sesión nuevamente";

            case 403:
                return "No tienes permisos para realizar esta acción";

            case 404:
                return "No se encontró el recurso solicitado";

            case 500:
                return "Error del servidor. Por favor intenta de nuevo en unos momentos";

            case 503:
                return "Servicio temporalmente no disponible. Intenta de nuevo pronto";

            default:
                break;
        }
    }

    // Handle timeout errors
    if (error.message && error.message.toLowerCase().includes('timeout')) {
        return "La operación tardó demasiado tiempo. Verifica tu conexión e intenta nuevamente";
    }

    // Handle aborted requests
    if (error.message && error.message.toLowerCase().includes('abort')) {
        return "La operación fue cancelada. Intenta nuevamente";
    }

    // Return generic message with original error for debugging
    if (error.message) {
        return `Error: ${error.message}`;
    }

    return "Error inesperado. Por favor contacta al administrador";
}

export function getPaymentErrorMessage(error: any): string {
    if (!navigator.onLine) {
        return "Sin conexión. El pago no se procesó";
    }

    if (error.code === '23503') {
        return "Error: El monto o el método de pago no son válidos";
    }

    if (error.message) {
        return `Error al procesar pago: ${error.message}`;
    }

    return "No se pudo procesar el pago. Intenta nuevamente";
}

export function getShiftStartErrorMessage(error: any): string {
    if (!navigator.onLine) {
        return "Sin conexión a internet. No se pudo iniciar el turno";
    }

    if (error.code === '23505') {
        return "Ya tienes un turno activo. Cierra tu turno actual antes de iniciar uno nuevo";
    }

    if (error.message && error.message.includes('PIN')) {
        return "PIN incorrecto. Verifica e intenta nuevamente";
    }

    if (error.message) {
        return `No se pudo iniciar el turno: ${error.message}`;
    }

    return "Error al iniciar turno. Contacta al administrador";
}

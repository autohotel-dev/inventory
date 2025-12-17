/**
 * Sistema de logging centralizado
 * Reemplaza console.log con un sistema más robusto
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    data?: unknown;
    timestamp: string;
}

/**
 * Determina si estamos en modo desarrollo
 */
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Formatea un mensaje de log con timestamp
 */
function formatLogMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data) {
        return `${prefix} ${message}\n${JSON.stringify(data, null, 2)}`;
    }

    return `${prefix} ${message}`;
}

/**
 * Logger principal
 */
export const logger = {
    /**
     * Log de debug - solo en desarrollo
     */
    debug: (message: string, data?: unknown) => {
        if (isDevelopment) {
            console.debug(formatLogMessage('debug', message, data));
        }
    },

    /**
     * Log de información - solo en desarrollo
     */
    info: (message: string, data?: unknown) => {
        if (isDevelopment) {
            console.info(formatLogMessage('info', message, data));
        }
    },

    /**
     * Log de advertencia - siempre se muestra
     */
    warn: (message: string, data?: unknown) => {
        console.warn(formatLogMessage('warn', message, data));
    },

    /**
     * Log de error - siempre se muestra
     */
    error: (message: string, error?: unknown) => {
        const errorData = error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error;

        console.error(formatLogMessage('error', message, errorData));
    },

    /**
     * Log de error con contexto adicional
     */
    errorWithContext: (message: string, error: unknown, context?: Record<string, unknown>) => {
        const errorData = error instanceof Error
            ? { message: error.message, stack: error.stack, context }
            : { error, context };

        console.error(formatLogMessage('error', message, errorData));
    },
};

/**
 * Helper para crear un logger con contexto
 * Útil para agregar información de módulo/componente a todos los logs
 */
export function createLogger(context: string) {
    return {
        debug: (message: string, data?: unknown) =>
            logger.debug(`[${context}] ${message}`, data),

        info: (message: string, data?: unknown) =>
            logger.info(`[${context}] ${message}`, data),

        warn: (message: string, data?: unknown) =>
            logger.warn(`[${context}] ${message}`, data),

        error: (message: string, error?: unknown) =>
            logger.error(`[${context}] ${message}`, error),

        errorWithContext: (message: string, error: unknown, additionalContext?: Record<string, unknown>) =>
            logger.errorWithContext(`[${context}] ${message}`, error, additionalContext),
    };
}

/**
 * Helper para log de performance
 */
export function logPerformance(label: string, startTime: number) {
    const duration = performance.now() - startTime;
    logger.debug(`Performance: ${label}`, { duration: `${duration.toFixed(2)}ms` });
}

/**
 * Decorator para medir tiempo de ejecución de funciones
 */
export function measureTime(label?: string) {
    return function (
        target: unknown,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: unknown[]) {
            const start = performance.now();
            const result = await originalMethod.apply(this, args);
            const duration = performance.now() - start;

            logger.debug(`${label || propertyKey} execution time`, {
                duration: `${duration.toFixed(2)}ms`
            });

            return result;
        };

        return descriptor;
    };
}

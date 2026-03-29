/**
 * Utilidades para formatear datos
 */

/**
 * Formatea un número como moneda mexicana (MXN)
 * @param amount - Cantidad a formatear
 * @returns String formateado como moneda
 * @example formatCurrency(1234.56) // "$1,234.56"
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
    }).format(amount);
}

/**
 * Formatea una fecha en formato local mexicano
 * @param date - Fecha a formatear (string ISO o Date)
 * @returns String formateado como fecha
 * @example formatDate('2024-01-15') // "15/01/2024"
 */
export function formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat('es-MX').format(new Date(date));
}

/**
 * Formatea una fecha con hora en formato local mexicano
 * @param date - Fecha a formatear (string ISO o Date)
 * @returns String formateado como fecha y hora
 * @example formatDateTime('2024-01-15T14:30:00') // "15/01/2024, 14:30:00"
 */
export function formatDateTime(date: string | Date): string {
    return new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'short',
        timeStyle: 'medium',
    }).format(new Date(date));
}

/**
 * Formatea solo la hora de una fecha
 * @param date - Fecha a formatear (string ISO o Date)
 * @returns String formateado como hora
 * @example formatTime('2024-01-15T14:30:00') // "14:30:00"
 */
export function formatTime(date: string | Date): string {
    return new Intl.DateTimeFormat('es-MX', {
        timeStyle: 'medium',
    }).format(new Date(date));
}

/**
 * Formatea un número con separadores de miles
 * @param num - Número a formatear
 * @param decimals - Número de decimales (por defecto 2)
 * @returns String formateado
 * @example formatNumber(1234.567) // "1,234.57"
 */
export function formatNumber(num: number, decimals: number = 2): string {
    return new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
}

/**
 * Formatea un porcentaje
 * @param value - Valor decimal (0.15 = 15%)
 * @param decimals - Número de decimales (por defecto 2)
 * @returns String formateado como porcentaje
 * @example formatPercentage(0.1567) // "15.67%"
 */
export function formatPercentage(value: number, decimals: number = 2): string {
    return new Intl.NumberFormat('es-MX', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

/**
 * Formatea un número de teléfono mexicano (10 dígitos)
 * @param phone - Número de teléfono
 * @returns String formateado
 * @example formatPhone('5512345678') // "(55) 1234-5678"
 */
export function formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) return phone;

    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
}

/**
 * Formatea un RFC mexicano
 * @param rfc - RFC a formatear
 * @returns String formateado en mayúsculas
 * @example formatRFC('abc123456xyz') // "ABC123456XYZ"
 */
export function formatRFC(rfc: string): string {
    return rfc.toUpperCase().trim();
}

/**
 * Trunca un texto a una longitud máxima
 * @param text - Texto a truncar
 * @param maxLength - Longitud máxima
 * @param suffix - Sufijo a agregar (por defecto "...")
 * @returns String truncado
 * @example truncateText('Este es un texto largo', 10) // "Este es un..."
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitaliza la primera letra de cada palabra
 * @param text - Texto a capitalizar
 * @returns String capitalizado
 * @example capitalizeWords('hola mundo') // "Hola Mundo"
 */
export function capitalizeWords(text: string): string {
    return text
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Formatea un tiempo relativo (ej: "hace 5 minutos")
 * @param date - Fecha a comparar
 * @returns String con tiempo relativo
 * @example formatRelativeTime(new Date(Date.now() - 5 * 60 * 1000)) // "hace 5 minutos"
 */
export function formatRelativeTime(date: string | Date): string {
    const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((then.getTime() - now.getTime()) / 1000);

    const intervals = [
        { unit: 'year' as const, seconds: 31536000 },
        { unit: 'month' as const, seconds: 2592000 },
        { unit: 'day' as const, seconds: 86400 },
        { unit: 'hour' as const, seconds: 3600 },
        { unit: 'minute' as const, seconds: 60 },
        { unit: 'second' as const, seconds: 1 },
    ];

    for (const interval of intervals) {
        const count = Math.floor(diffInSeconds / interval.seconds);
        if (Math.abs(count) >= 1) {
            return rtf.format(count, interval.unit);
        }
    }

    return rtf.format(0, 'second');
}

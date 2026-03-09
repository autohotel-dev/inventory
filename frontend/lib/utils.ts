import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind CSS de forma inteligente
 * Evita conflictos y duplicados
 * @param inputs - Clases a combinar
 * @returns String con clases combinadas
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Verifica si las variables de entorno de Supabase están configuradas
 * Útil para verificación durante desarrollo
 */
export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;

/**
 * Genera un ID único simple (no criptográficamente seguro)
 * Útil para keys de React o IDs temporales
 * @returns String con ID único
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Espera un tiempo determinado (útil para delays)
 * @param ms - Milisegundos a esperar
 * @returns Promise que se resuelve después del tiempo especificado
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce de una función
 * @param func - Función a ejecutar
 * @param wait - Tiempo de espera en ms
 * @returns Función debounced
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle de una función
 * @param func - Función a ejecutar
 * @param limit - Tiempo mínimo entre ejecuciones en ms
 * @returns Función throttled
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Verifica si un valor es un objeto plano
 * @param value - Valor a verificar
 * @returns true si es un objeto plano
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

/**
 * Deep clone de un objeto (solo para objetos serializables)
 * @param obj - Objeto a clonar
 * @returns Clon profundo del objeto
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Omite propiedades de un objeto
 * @param obj - Objeto original
 * @param keys - Keys a omitir
 * @returns Nuevo objeto sin las keys especificadas
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
}

/**
 * Selecciona solo ciertas propiedades de un objeto
 * @param obj - Objeto original
 * @param keys - Keys a seleccionar
 * @returns Nuevo objeto solo con las keys especificadas
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

/**
 * Agrupa un array de objetos por una key
 * @param array - Array a agrupar
 * @param key - Key por la cual agrupar
 * @returns Objeto con arrays agrupados
 */
export function groupBy<T extends Record<string, any>>(
  array: T[],
  key: keyof T
): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

/**
 * Elimina duplicados de un array
 * @param array - Array con posibles duplicados
 * @param key - Key opcional para comparar objetos
 * @returns Array sin duplicados
 */
export function unique<T>(array: T[], key?: keyof T): T[] {
  if (!key) {
    return Array.from(new Set(array));
  }

  const seen = new Set();
  return array.filter((item) => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

/**
 * Ordena un array de objetos por una key
 * @param array - Array a ordenar
 * @param key - Key por la cual ordenar
 * @param order - Orden ascendente o descendente
 * @returns Array ordenado
 */
export function sortBy<T extends Record<string, any>>(
  array: T[],
  key: keyof T,
  order: "asc" | "desc" = "asc"
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
}

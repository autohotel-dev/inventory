/**
 * Constantes relacionadas con habitaciones y estancias
 */

/**
 * Tiempo de tolerancia en milisegundos (1 hora)
 * Usado para permitir que los huéspedes regresen sin cargo adicional
 */
export const TOLERANCE_MS = 60 * 60 * 1000; // 1 hora

/**
 * Tiempo de tolerancia en minutos (para UI)
 */
export const TOLERANCE_MINUTES = 60;

/**
 * Tiempo de tolerancia de salida en minutos (después de pagar)
 */
export const EXIT_TOLERANCE_MINUTES = 30;

/**
 * Tiempo de tolerancia de salida en milisegundos
 */
export const EXIT_TOLERANCE_MS = EXIT_TOLERANCE_MINUTES * 60 * 1000;

/**
 * Estados posibles de una habitación
 */
export const ROOM_STATUS = {
  LIBRE: "LIBRE",
  OCUPADA: "OCUPADA",
  SUCIA: "SUCIA",
  BLOQUEADA: "BLOQUEADA",
} as const;

export type RoomStatus = typeof ROOM_STATUS[keyof typeof ROOM_STATUS];

/**
 * Estados posibles de una estancia
 */
export const STAY_STATUS = {
  ACTIVA: "ACTIVA",
  FINALIZADA: "FINALIZADA",
  CANCELADA: "CANCELADA",
} as const;

export type StayStatus = typeof STAY_STATUS[keyof typeof STAY_STATUS];

/**
 * Tipos de tolerancia
 */
export const TOLERANCE_TYPE = {
  ROOM_EMPTY: "ROOM_EMPTY", // Habitación vacía (todos salieron)
  PERSON_LEFT: "PERSON_LEFT", // Una persona salió
} as const;

export type ToleranceType = typeof TOLERANCE_TYPE[keyof typeof TOLERANCE_TYPE];

/**
 * Número máximo de personas por defecto
 */
export const DEFAULT_MAX_PEOPLE = 2;

/**
 * Número mínimo de personas en una habitación ocupada
 */
export const MIN_PEOPLE_IN_ROOM = 1;

/**
 * Precios de promoción de 4 horas por tipo de habitación
 */
export const FOUR_HOUR_PROMO_PRICES: Record<string, number> = {
  "Alberca": 1000,
  "Jacuzzi y Sauna": 600,
  "Jacuzzi": 440,
  "Sencilla": 300,
  "Torre": 270,
} as const;

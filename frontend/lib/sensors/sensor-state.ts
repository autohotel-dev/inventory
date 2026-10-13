// ─── Estado de sensores de cochera ──────────────────────────────────
// Única fuente de verdad para interpretar una fila de `sensors`.
// El daemon local (scripts/sensors/daemon.js) actualiza `last_seen` cada 2 min
// para todo sensor que su hub ve en línea (latido), así que un `last_seen`
// viejo significa que el sensor, su hub o el daemon dejaron de reportar.

export interface Sensor {
    id: string;
    room_id: string | null;
    device_id: string;
    name: string;
    status: 'ONLINE' | 'OFFLINE' | null;
    /** null = el hub aún no conoce el estado (p. ej. tras reiniciarse, hasta que la cochera se mueva) */
    is_open: boolean | null;
    battery_level: number | null;
    last_seen: string | null;
    door_opened_at: string | null;
}

/** Sin latido en este tiempo => "sin señal" (latido cada 2 min + margen) */
export const SENSOR_NO_SIGNAL_MS = 7 * 60 * 1000;
export const LOW_BATTERY_PERCENT = 20;
/** Minutos con la cochera abierta en una habitación ocupada para la alerta de tiempo */
export const DOOR_OPEN_WARNING_MIN = 5;
export const DOOR_OPEN_CRITICAL_MIN = 10;

export type DoorState = 'OPEN' | 'CLOSED' | 'UNKNOWN';
export type SignalState = 'ONLINE' | 'OFFLINE' | 'NO_SIGNAL';

export function getSignalState(sensor: Sensor, now = Date.now()): SignalState {
    if (sensor.status !== 'ONLINE') return 'OFFLINE';
    if (!sensor.last_seen || now - new Date(sensor.last_seen).getTime() > SENSOR_NO_SIGNAL_MS) return 'NO_SIGNAL';
    return 'ONLINE';
}

export function getDoorState(sensor: Sensor): DoorState {
    if (sensor.is_open === true) return 'OPEN';
    if (sensor.is_open === false) return 'CLOSED';
    return 'UNKNOWN';
}

/** Puerta abierta según un sensor que está reportando: solo esto debe disparar alertas */
export function isDoorOpenReliable(sensor: Sensor, now = Date.now()): boolean {
    return getDoorState(sensor) === 'OPEN' && getSignalState(sensor, now) === 'ONLINE';
}

export function isLowBattery(sensor: Pick<Sensor, 'battery_level'>): boolean {
    return typeof sensor.battery_level === 'number' && sensor.battery_level < LOW_BATTERY_PERCENT;
}

export function getDoorOpenMinutes(sensor: Sensor, now = Date.now()): number {
    if (getDoorState(sensor) !== 'OPEN' || !sensor.door_opened_at) return 0;
    return Math.max(0, Math.floor((now - new Date(sensor.door_opened_at).getTime()) / 60000));
}

const SIGNAL_RANK: Record<SignalState, number> = { ONLINE: 2, NO_SIGNAL: 1, OFFLINE: 0 };

/**
 * Un sensor por habitación. Si hay más de uno asignado (p. ej. un sensor reemplazado
 * que sigue registrado), se usa el que está reportando y, a igualdad, el más reciente.
 */
export function getSensorsByRoom(sensors: Sensor[], now = Date.now()): Map<string, Sensor> {
    const byRoom = new Map<string, Sensor>();
    for (const sensor of sensors) {
        if (!sensor.room_id) continue;
        const current = byRoom.get(sensor.room_id);
        if (!current) {
            byRoom.set(sensor.room_id, sensor);
            continue;
        }
        const diff = SIGNAL_RANK[getSignalState(sensor, now)] - SIGNAL_RANK[getSignalState(current, now)];
        const newer = (sensor.last_seen || '') > (current.last_seen || '');
        if (diff > 0 || (diff === 0 && newer)) byRoom.set(sensor.room_id, sensor);
    }
    return byRoom;
}

/**
 * El servicio completo está caído (daemon detenido, PC apagada o sin red) cuando
 * ningún sensor que estaba en línea manda latido.
 */
export function isSensorServiceDown(sensors: Sensor[], now = Date.now()): boolean {
    const expected = sensors.filter(s => s.room_id && s.status === 'ONLINE');
    return expected.length > 0 && expected.every(s => getSignalState(s, now) === 'NO_SIGNAL');
}

export const DOOR_LABEL: Record<DoorState, string> = {
    OPEN: 'Cochera abierta',
    CLOSED: 'Cochera cerrada',
    UNKNOWN: 'Cochera sin dato (se actualiza cuando se mueva)',
};

export const SIGNAL_LABEL: Record<SignalState, string> = {
    ONLINE: 'En línea',
    OFFLINE: 'Sensor desconectado del hub',
    NO_SIGNAL: 'Sin señal',
};

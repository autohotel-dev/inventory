"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Room } from "@/components/sales/room-types";
import {
    type Sensor,
    type DoorState,
    type SignalState,
    getDoorState,
    getSignalState,
    getDoorOpenMinutes,
    getSensorsByRoom,
    isDoorOpenReliable,
    isLowBattery,
    isSensorServiceDown,
    DOOR_OPEN_WARNING_MIN,
} from "@/lib/sensors/sensor-state";

const SERVICE_DOWN_TOAST_ID = "sensor-service-down";

interface Options {
    sensors: Sensor[];
    rooms: Room[];
    now: number;
    playError: () => void;
}

/**
 * Alertas de cocheras para recepción (toast + sonido):
 *  - Habitación OCUPADA cuya cochera se abre (cliente saliendo).
 *  - Cochera abierta más de DOOR_OPEN_WARNING_MIN en habitación OCUPADA.
 *  - Servicio de sensores sin señal (daemon/PC/red caídos) y sensor de habitación ocupada que deja de reportar.
 *  - Batería baja (sin sonido).
 * En habitaciones libres la cochera abierta es lo normal: no alerta.
 */
export function useSensorAlerts({ sensors, rooms, now, playError }: Options) {
    const prevDoor = useRef<Map<string, DoorState>>(new Map());
    const prevSignal = useRef<Map<string, SignalState>>(new Map());
    const doorTimeAlerted = useRef<Set<string>>(new Set());
    const batteryAlerted = useRef<Set<string>>(new Set());
    const serviceDown = useRef(false);

    useEffect(() => {
        if (sensors.length === 0 || rooms.length === 0) return;

        const roomsById = new Map(rooms.map(r => [r.id, r]));
        const down = isSensorServiceDown(sensors, now);

        // ── Servicio completo caído: un solo aviso, persistente hasta que vuelva ──
        if (down && !serviceDown.current) {
            toast.error("Sensores de cochera sin señal", {
                id: SERVICE_DOWN_TOAST_ID,
                duration: Infinity,
                description: "El servicio de sensores dejó de reportar. Revisa la PC de recepción (pm2 logs sensor-monitor). Las alertas de cochera están pausadas.",
            });
            playError();
        } else if (!down && serviceDown.current) {
            toast.dismiss(SERVICE_DOWN_TOAST_ID);
            toast.success("Sensores de cochera reconectados");
        }
        serviceDown.current = down;

        for (const sensor of getSensorsByRoom(sensors, now).values()) {
            const room = roomsById.get(sensor.room_id!);
            const occupied = room?.status === "OCUPADA";
            const label = `Hab ${room?.number ?? sensor.name}`;
            const door = getDoorState(sensor);
            const signal = getSignalState(sensor, now);
            const lastDoor = prevDoor.current.get(sensor.id);
            const lastSignal = prevSignal.current.get(sensor.id);
            prevDoor.current.set(sensor.id, door);
            prevSignal.current.set(sensor.id, signal);

            // Primera lectura (carga de página): solo inicializar
            if (lastDoor === undefined) continue;

            // ── Ocupada: la cochera se abre ──
            if (occupied && door === "OPEN" && lastDoor !== "OPEN" && signal === "ONLINE") {
                toast.error(`¡Cochera abierta! ${label}`, {
                    duration: 10000,
                    description: "Se abrió la cochera de una habitación ocupada.",
                });
                playError();
            }

            // ── Ocupada: abierta demasiado tiempo ──
            if (occupied && isDoorOpenReliable(sensor, now)) {
                const minutes = getDoorOpenMinutes(sensor, now);
                if (minutes >= DOOR_OPEN_WARNING_MIN && !doorTimeAlerted.current.has(sensor.id)) {
                    doorTimeAlerted.current.add(sensor.id);
                    toast.error(`⏱️ ${label} — Cochera abierta +${minutes} min`, {
                        duration: 15000,
                        description: `Revisar habitación. Lleva más de ${DOOR_OPEN_WARNING_MIN} minutos abierta.`,
                    });
                    playError();
                }
            } else {
                doorTimeAlerted.current.delete(sensor.id);
            }

            // ── Ocupada: su sensor deja de reportar (si no es caída general) ──
            if (!down && occupied && lastSignal === "ONLINE" && signal !== "ONLINE") {
                toast.warning(`📡 ${label} — sensor de cochera sin señal`, {
                    duration: 15000,
                    description: signal === "OFFLINE"
                        ? "El hub perdió el sensor (batería o alcance). No habrá alertas de esta cochera."
                        : "El sensor dejó de reportar. No habrá alertas de esta cochera.",
                });
                playError();
            }

            // ── Batería baja: una vez por sesión ──
            if (isLowBattery(sensor) && !batteryAlerted.current.has(sensor.id)) {
                batteryAlerted.current.add(sensor.id);
                toast.warning(`🔋 Batería baja: ${label}`, {
                    duration: 10000,
                    description: `Sensor ${sensor.name} al ${sensor.battery_level}%. Reemplazar pila.`,
                });
            }
        }
    }, [sensors, rooms, now, playError]);
}

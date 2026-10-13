"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Sensor, getSignalState, getDoorOpenMinutes } from "@/lib/sensors/sensor-state";

export type { Sensor } from "@/lib/sensors/sensor-state";

/** Re-evalúa "sin señal" y minutos abiertos aunque no lleguen cambios (si el daemon muere, nada llega) */
const CLOCK_TICK_MS = 30000;
/** Red de seguridad por si se pierde algún evento de Realtime */
const SAFETY_REFETCH_MS = 60000;
/** Agrupa ráfagas de Realtime (el latido del daemon actualiza ~40 filas a la vez) */
const REALTIME_BATCH_MS = 300;

/** Lo que el tablero muestra de un sensor: si no cambia, no hay que redibujar */
function visibleKey(rows: Sensor[], now: number): string {
    return rows.map(s =>
        `${s.id}|${s.room_id}|${s.name}|${s.status}|${s.is_open}|${s.battery_level}|${s.door_opened_at}|${getSignalState(s, now)}|${getDoorOpenMinutes(s, now)}`
    ).join(';');
}

/**
 * Sensores de cochera. Única fuente: tabla `sensors` de Supabase (Realtime + refetch).
 * Los datos crudos viven en un ref y solo se publican al estado (re-render del tablero)
 * cuando cambia algo visible; el latido del daemon (solo `last_seen`) no provoca renders.
 */
export function useSensors() {
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(() => Date.now());

    const rowsRef = useRef<Map<string, Sensor>>(new Map());
    const publishedKey = useRef<string | null>(null);
    const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const publish = useCallback(() => {
        const t = Date.now();
        const rows = [...rowsRef.current.values()];
        const key = visibleKey(rows, t);
        if (key === publishedKey.current) return;
        publishedKey.current = key;
        setSensors(rows);
        setNow(t);
    }, []);

    const fetchSensors = useCallback(async () => {
        const supabase = createClient();
        try {
            const { data, error } = await supabase
                .from("sensors")
                .select("*")
                .order("created_at", { ascending: true });

            if (error) throw error;
            rowsRef.current = new Map((data || []).map((s: Sensor) => [s.id, s]));
            publish();
        } catch (error) {
            console.error("Error fetching sensors:", error);
        } finally {
            setLoading(false);
        }
    }, [publish]);

    useEffect(() => {
        fetchSensors();

        const supabase = createClient();
        let wasSubscribed = false;

        const schedulePublish = () => {
            if (batchTimer.current) return;
            batchTimer.current = setTimeout(() => {
                batchTimer.current = null;
                publish();
            }, REALTIME_BATCH_MS);
        };

        const channel = supabase
            .channel('realtime-sensors')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sensors' },
                (payload: any) => {
                    if (payload.eventType === 'DELETE') {
                        rowsRef.current.delete(payload.old.id);
                    } else {
                        rowsRef.current.set(payload.new.id, payload.new as Sensor);
                    }
                    schedulePublish();
                }
            )
            .subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                    // Re-subscribed after a drop: events in between were lost, reload
                    if (wasSubscribed) fetchSensors();
                    wasSubscribed = true;
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn("[Sensors] Realtime:", status);
                }
            });

        const onVisible = () => { if (document.visibilityState === 'visible') fetchSensors(); };
        document.addEventListener('visibilitychange', onVisible);
        const refetchTimer = setInterval(fetchSensors, SAFETY_REFETCH_MS);
        const clockTimer = setInterval(publish, CLOCK_TICK_MS);

        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            clearInterval(refetchTimer);
            clearInterval(clockTimer);
            if (batchTimer.current) clearTimeout(batchTimer.current);
            batchTimer.current = null;
            supabase.removeChannel(channel);
        };
    }, [fetchSensors, publish]);

    return {
        sensors,
        loading,
        now,
        refreshSensors: fetchSensors,
    };
}

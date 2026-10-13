"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Sensor } from "@/lib/sensors/sensor-state";

export type { Sensor } from "@/lib/sensors/sensor-state";

/** Re-evalúa "sin señal" aunque no lleguen cambios (si el daemon muere, nada llega) */
const CLOCK_TICK_MS = 30000;
/** Red de seguridad por si se pierde algún evento de Realtime */
const SAFETY_REFETCH_MS = 60000;

/**
 * Sensores de cochera. Única fuente: tabla `sensors` de Supabase (Realtime + refetch).
 * El daemon local escribe ahí cada cambio al instante y un latido cada 2 min.
 * `now` avanza cada 30s para que los consumidores recalculen señal y minutos abiertos.
 */
export function useSensors() {
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(() => Date.now());

    const fetchSensors = useCallback(async () => {
        const supabase = createClient();
        try {
            const { data, error } = await supabase
                .from("sensors")
                .select("*")
                .order("created_at", { ascending: true });

            if (error) throw error;
            setSensors(data || []);
        } catch (error) {
            console.error("Error fetching sensors:", error);
        } finally {
            setLoading(false);
            setNow(Date.now());
        }
    }, []);

    useEffect(() => {
        fetchSensors();

        const supabase = createClient();
        let wasSubscribed = false;

        const channel = supabase
            .channel('realtime-sensors')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sensors' },
                (payload: any) => {
                    if (payload.eventType === 'INSERT') {
                        setSensors(prev => prev.some(s => s.id === payload.new.id) ? prev : [...prev, payload.new as Sensor]);
                    } else if (payload.eventType === 'UPDATE') {
                        const updated = payload.new as Sensor;
                        setSensors(prev => prev.map(s => s.id === updated.id ? updated : s));
                    } else if (payload.eventType === 'DELETE') {
                        setSensors(prev => prev.filter(s => s.id !== payload.old.id));
                    }
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
        const clockTimer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);

        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            clearInterval(refetchTimer);
            clearInterval(clockTimer);
            supabase.removeChannel(channel);
        };
    }, [fetchSensors]);

    return {
        sensors,
        loading,
        now,
        refreshSensors: fetchSensors,
    };
}

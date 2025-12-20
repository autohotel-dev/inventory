"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export interface Sensor {
    id: string;
    room_id: string;
    device_id: string;
    name: string;
    status: 'ONLINE' | 'OFFLINE';
    is_open: boolean;
    battery_level: number;
    last_seen: string;
}

export function useSensors() {
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSensors = useCallback(async () => {
        const supabase = createClient();
        try {
            const { data, error } = await supabase
                .from("sensors")
                .select("*");

            if (error) throw error;
            setSensors(data || []);
        } catch (error) {
            console.error("Error fetching sensors:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSensors();

        const supabase = createClient();

        // Subscribe to realtime changes
        const channel = supabase
            .channel('sensors-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'sensors'
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setSensors(prev => [...prev, payload.new as Sensor]);
                    } else if (payload.eventType === 'UPDATE') {
                        const newSensor = payload.new as Sensor;
                        setSensors(prev => prev.map(s => s.id === newSensor.id ? newSensor : s));

                        // Alert logic if needed (handled in component usually, but we can do global alerts here if preferred)
                        // Ideally, the component dealing with the room board handles the "Toast" to avoid duplicates if this hook is used in multiple places.
                    } else if (payload.eventType === 'DELETE') {
                        setSensors(prev => prev.filter(s => s.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchSensors]);

    return { sensors, loading, refreshSensors: fetchSensors };
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { luxorRealtimeClient } from "@/lib/api/websocket";
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
        try {
            const { apiClient } = await import("@/lib/api/client");
            const { data } = await apiClient.get('/system/crud/sensors');
            setSensors(data || []);
        } catch (error) {
            console.error("Error fetching sensors:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial fetch
        fetchSensors();

        // Subscribe to realtime changes
        const unsubscribe = luxorRealtimeClient.subscribe("sensors", (payload) => {
            console.log("[Sensors] Realtime event:", payload);
            if (payload.type === 'INSERT') {
                setSensors(prev => {
                    const exists = prev.some(s => s.id === payload.record.id);
                    if (exists) return prev;
                    return [...prev, payload.record as Sensor];
                });
            } else if (payload.type === 'UPDATE') {
                const newSensor = payload.record as Sensor;
                setSensors(prev => prev.map(s => s.id === newSensor.id ? newSensor : s));
            } else if (payload.type === 'DELETE') {
                setSensors(prev => prev.filter(s => s.id !== payload.old_record.id));
            }
        });

        return () => {
            unsubscribe();
        };
    }, [fetchSensors]);

    return { sensors, loading, refreshSensors: fetchSensors };
}

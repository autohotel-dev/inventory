"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { PRINT_SERVER_URL } from '@/lib/print/constants';

export interface Sensor {
    id: string;
    room_id: string;
    device_id: string;
    name: string;
    status: 'ONLINE' | 'OFFLINE';
    is_open: boolean;
    battery_level: number;
    last_seen: string;
    door_opened_at: string | null;
}

/**
 * Check if a sensor is stale (offline for more than 1 hour)
 */
export function isSensorStale(sensor: Sensor): boolean {
    if (!sensor.last_seen) return true;
    const lastSeen = new Date(sensor.last_seen).getTime();
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    return lastSeen < twentyFourHoursAgo;
}

/**
 * Get the duration in minutes a door has been open.
 * Uses the backend-provided door_opened_at timestamp (survives page reload).
 * Falls back to client-side tracking if door_opened_at is not available yet.
 */
export function getDoorOpenMinutes(sensor: Sensor, fallbackTimestamps?: Map<string, number>): number {
    if (!sensor.is_open) return 0;
    // Prefer backend timestamp (persists across reloads)
    if (sensor.door_opened_at) {
        return Math.floor((Date.now() - new Date(sensor.door_opened_at).getTime()) / 60000);
    }
    // Fallback to client-side tracking (for sensors without the migration applied yet)
    const openedAt = fallbackTimestamps?.get(sensor.id);
    if (openedAt) {
        return Math.floor((Date.now() - openedAt) / 60000);
    }
    return 0;
}

export function useSensors() {
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [loading, setLoading] = useState(true);

    // Fallback: client-side tracking for sensors that don't have door_opened_at yet
    const doorOpenTimestamps = useRef<Map<string, number>>(new Map());

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
        }
    }, []);

    const pollLocalSensors = useCallback(async () => {
        try {
            const printServerUrl = 'http://localhost:3001';
            const res = await fetch(`${printServerUrl}/sensors/status`);
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            
            const data = await res.json();
            if (data && data.success && data.sensors) {
                setSensors(prev => {
                    let changed = false;
                    const next = prev.map(sensor => {
                        const localSensor = data.sensors[sensor.device_id];
                        if (localSensor) {
                            const newIsOpen = localSensor.isOpen;
                            const newBattery = localSensor.battery !== null ? localSensor.battery : sensor.battery_level;
                            const newStatus: 'ONLINE' | 'OFFLINE' = localSensor.online ? 'ONLINE' : 'OFFLINE';
                            const newLastSeen = localSensor.lastSeen || sensor.last_seen;
                            // Only trigger re-render for visually-relevant changes (not last_seen)
                            if (sensor.is_open !== newIsOpen || sensor.battery_level !== newBattery || sensor.status !== newStatus) {
                                changed = true;
                                return { ...sensor, is_open: newIsOpen, battery_level: newBattery, status: newStatus, last_seen: newLastSeen };
                            }
                        }
                        return sensor;
                    });
                    return changed ? next : prev;
                });
            }
        } catch (err: any) {
            console.debug("Local LAN sensor poll skipped/failed, trying configured domain fallback:", err.message);
            try {
                if (PRINT_SERVER_URL === 'http://localhost:3001') return;
                const res = await fetch(`${PRINT_SERVER_URL}/sensors/status`);
                if (!res.ok) return;
                const data = await res.json();
                if (data && data.success && data.sensors) {
                    setSensors(prev => {
                        let changed = false;
                        const next = prev.map(sensor => {
                            const localSensor = data.sensors[sensor.device_id];
                            if (localSensor) {
                                const newIsOpen = localSensor.isOpen;
                                const newBattery = localSensor.battery !== null ? localSensor.battery : sensor.battery_level;
                                const newStatus: 'ONLINE' | 'OFFLINE' = localSensor.online ? 'ONLINE' : 'OFFLINE';
                                const newLastSeen = localSensor.lastSeen || sensor.last_seen;
                                // Only trigger re-render for visually-relevant changes (not last_seen)
                                if (sensor.is_open !== newIsOpen || sensor.battery_level !== newBattery || sensor.status !== newStatus) {
                                    changed = true;
                                    return { ...sensor, is_open: newIsOpen, battery_level: newBattery, status: newStatus, last_seen: newLastSeen };
                                }
                            }
                            return sensor;
                        });
                        return changed ? next : prev;
                    });
                }
            } catch (fallbackErr) {
                // Fail silently
            }
        }
    }, []);

    // Polling local sensor server for LAN fallback resilience
    useEffect(() => {
        pollLocalSensors(); // Initial poll
        const interval = setInterval(pollLocalSensors, 3000);
        return () => clearInterval(interval);
    }, [pollLocalSensors]);

    useEffect(() => {
        // Initial fetch
        fetchSensors();

        const supabase = createClient();

        // Subscribe to realtime changes
        const channel = supabase
            .channel('realtime-sensors')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'sensors'
                },
                (payload: any) => {
                    console.debug("[Sensors] Realtime event:", payload);

                    if (payload.eventType === 'INSERT') {
                        setSensors(prev => {
                            const exists = prev.some(s => s.id === payload.new.id);
                            if (exists) return prev;
                            return [...prev, payload.new as Sensor];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const newSensor = payload.new as Sensor;
                        setSensors(prev => prev.map(s => s.id === newSensor.id ? newSensor : s));
                    } else if (payload.eventType === 'DELETE') {
                        setSensors(prev => prev.filter(s => s.id !== payload.old.id));
                    }
                }
            )
            .subscribe((status: string) => {
                console.debug("[Sensors] Subscription status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchSensors]);

    // Fallback: track door open timestamps client-side (for sensors without door_opened_at)
    useEffect(() => {
        sensors.forEach(sensor => {
            const ts = doorOpenTimestamps.current;
            if (sensor.is_open && !sensor.door_opened_at) {
                // Only track client-side if backend doesn't provide the timestamp
                if (!ts.has(sensor.id)) {
                    ts.set(sensor.id, Date.now());
                }
            } else if (!sensor.is_open) {
                ts.delete(sensor.id);
            }
        });
    }, [sensors]);

    return {
        sensors,
        loading,
        refreshSensors: fetchSensors,
        doorOpenTimestamps: doorOpenTimestamps.current,
    };
}

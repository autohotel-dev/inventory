"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

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

/**
 * Check if a sensor is stale (offline for more than 1 hour)
 */
export function isSensorStale(sensor: Sensor): boolean {
    if (!sensor.last_seen) return true;
    const lastSeen = new Date(sensor.last_seen).getTime();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return lastSeen < oneHourAgo;
}

/**
 * Get the duration in minutes a door has been open.
 * Returns 0 if the door is closed or unknown.
 */
export function getDoorOpenMinutes(sensorId: string, openTimestamps: Map<string, number>): number {
    const openedAt = openTimestamps.get(sensorId);
    if (!openedAt) return 0;
    return Math.floor((Date.now() - openedAt) / 60000);
}

export function useSensors() {
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [loading, setLoading] = useState(true);

    // Track when each door was opened (sensorId -> timestamp)
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
            // First try localhost:3001 for local PC operation, then fall back to env URL
            const printServerUrl = 'http://localhost:3001';
            const res = await fetch(`${printServerUrl}/sensors/status`);
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            
            const data = await res.json();
            if (data && data.success && data.sensors) {
                setSensors(prev => 
                    prev.map(sensor => {
                        const localSensor = data.sensors[sensor.device_id];
                        if (localSensor) {
                            return {
                                ...sensor,
                                is_open: localSensor.isOpen,
                                battery_level: localSensor.battery !== null ? localSensor.battery : sensor.battery_level,
                                status: localSensor.online ? 'ONLINE' : 'OFFLINE',
                                last_seen: localSensor.lastSeen || sensor.last_seen
                            };
                        }
                        return sensor;
                    })
                );
            }
        } catch (err: any) {
            console.debug("Local LAN sensor poll skipped/failed, trying configured domain fallback:", err.message);
            // Fallback to the configured public print server URL (in case they use a tablet on WiFi)
            try {
                const printServerUrl = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';
                const res = await fetch(`${printServerUrl}/sensors/status`);
                if (!res.ok) return;
                const data = await res.json();
                if (data && data.success && data.sensors) {
                    setSensors(prev => 
                        prev.map(sensor => {
                            const localSensor = data.sensors[sensor.device_id];
                            if (localSensor) {
                                return {
                                    ...sensor,
                                    is_open: localSensor.isOpen,
                                    battery_level: localSensor.battery !== null ? localSensor.battery : sensor.battery_level,
                                    status: localSensor.online ? 'ONLINE' : 'OFFLINE',
                                    last_seen: localSensor.lastSeen || sensor.last_seen
                                };
                            }
                            return sensor;
                        })
                    );
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
                    console.log("[Sensors] Realtime event:", payload);

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
                console.log("[Sensors] Subscription status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchSensors]);

    // Track door open timestamps
    useEffect(() => {
        sensors.forEach(sensor => {
            const ts = doorOpenTimestamps.current;
            if (sensor.is_open) {
                // If just opened, record the timestamp
                if (!ts.has(sensor.id)) {
                    ts.set(sensor.id, Date.now());
                }
            } else {
                // Door closed, clear the timestamp
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

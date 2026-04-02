import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export type NotificationType = 'success' | 'alert' | 'info';
export type SoundEvent = 'new_entry' | 'vehicle_request' | 'checkout_request' | 'car_ready' | 'vehicle_registered' | 'new_consumption' | 'new_message';

/**
 * Hook puro para síntesis y reproducción de sonidos y tonos.
 * No tiene dependencias de Supabase o canales.
 */
export function useSoundEngine() {
    const audioContextRef = useRef<AudioContext | null>(null);
    const [isAudioReady, setIsAudioReady] = useState(false);

    const initAudio = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    };

    useEffect(() => {
        const onFirstInteraction = () => {
            try {
                initAudio();
                const ctx = audioContextRef.current;
                if (ctx && ctx.state === 'suspended') {
                    void ctx.resume();
                }
            } catch { /* noop */ }

            const ctx = audioContextRef.current;
            if (ctx && ctx.state === 'running') {
                setIsAudioReady(true);
                window.removeEventListener('pointerdown', onFirstInteraction);
                window.removeEventListener('touchstart', onFirstInteraction);
                window.removeEventListener('click', onFirstInteraction);
                window.removeEventListener('keydown', onFirstInteraction);
            }
        };

        window.addEventListener('pointerdown', onFirstInteraction, { passive: true });
        window.addEventListener('touchstart', onFirstInteraction, { passive: true });
        window.addEventListener('click', onFirstInteraction, { passive: true });
        window.addEventListener('keydown', onFirstInteraction);
        return () => {
            window.removeEventListener('pointerdown', onFirstInteraction);
            window.removeEventListener('touchstart', onFirstInteraction);
            window.removeEventListener('click', onFirstInteraction);
            window.removeEventListener('keydown', onFirstInteraction);
        };
    }, []);

    const unlockAudio = useCallback(async (playTestTone = false) => {
        try {
            initAudio();
            const ctx = audioContextRef.current;
            if (!ctx) return false;

            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            const ok = ctx.state === 'running';
            if (ok) setIsAudioReady(true);
            if (ok && playTestTone) {
                const now = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, now);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.15, now + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.3);
            }

            return ok;
        } catch { return false; }
    }, []);

    const playTone = useCallback((type: NotificationType) => {
        initAudio();
        const ctx = audioContextRef.current;
        if (!ctx) return;

        const play = () => {
            const now = ctx.currentTime;
            const scheduleTone = (freq: number, start: number, peak: number, releaseEnd: number, oscType: OscillatorType = 'sine') => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = oscType;
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(peak, start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, releaseEnd);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(releaseEnd + 0.02);
            };

            if (type === 'alert') {
                [523.25, 659.25, 783.99].forEach((f, i) => {
                    const t = now + (i * 0.09);
                    scheduleTone(f, t, 0.28, t + 1.4, 'triangle');
                });
                scheduleTone(196, now, 0.06, now + 1.0, 'sine');
            } else if (type === 'success') {
                [523.25, 659.25, 783.99].forEach((f, i) => {
                    const t = now + (i * 0.05);
                    scheduleTone(f, t, 0.15, now + 1.5, 'triangle');
                });
            }
        };

        if (ctx.state === 'suspended') {
            void ctx.resume().then(play).catch(() => {});
            return;
        }

        if (ctx.state === 'running') play();
    }, []);

    const playSound = useCallback((event: SoundEvent) => {
        initAudio();
        const ctx = audioContextRef.current;
        if (!ctx) return;

        const play = () => {
            const now = ctx.currentTime;
            const scheduleTone = (freq: number, start: number, peak: number, releaseEnd: number, oscType: OscillatorType = 'sine') => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = oscType;
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(peak, start + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.001, releaseEnd);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(releaseEnd + 0.02);
            };

            switch (event) {
                case 'new_entry':
                    [523.25, 659.25, 783.99].forEach((f, i) => {
                        const t = now + (i * 0.09);
                        scheduleTone(f, t, 0.30, t + 1.2, 'triangle');
                    });
                    scheduleTone(196, now, 0.05, now + 0.9, 'sine');
                    break;
                case 'vehicle_request':
                    [0, 0.14, 0.28].forEach((o) => {
                        const t = now + o;
                        scheduleTone(932.33, t, 0.22, t + 0.22, 'square');
                    });
                    scheduleTone(466.16, now, 0.04, now + 0.5, 'sine');
                    break;
                case 'checkout_request':
                    [392.0, 523.25].forEach((f, i) => {
                        const t = now + (i * 0.16);
                        scheduleTone(f, t, 0.20, t + 1.0, 'triangle');
                    });
                    break;
                case 'car_ready':
                    playTone('success');
                    break;
                case 'vehicle_registered':
                    scheduleTone(587.33, now, 0.10, now + 0.6, 'triangle');
                    break;
                case 'new_consumption':
                    [440, 554.37, 659.25].forEach((f, i) => {
                        const t = now + (i * 0.08);
                        scheduleTone(f, t, 0.20, t + 0.8, 'triangle');
                    });
                    break;
                case 'new_message':
                    [659.25, 880].forEach((f, i) => {
                        const t = now + (i * 0.1);
                        scheduleTone(f, t, 0.15, t + 0.3, 'sine');
                    });
                    break;
            }
        };

        if (ctx.state === 'suspended') {
            void ctx.resume().then(play).catch(() => {});
            return;
        }

        if (ctx.state === 'running') play();
    }, [playTone]);

    return {
        playTone,
        playSound,
        playSuccess: () => playTone('success'),
        playError: () => playTone('alert'),
        playAlert: () => playTone('alert'),
        playNewEntry: () => playSound('new_entry'),
        playVehicleRequest: () => playSound('vehicle_request'),
        playCheckoutRequest: () => playSound('checkout_request'),
        playCarReady: () => playSound('car_ready'),
        playVehicleRegistered: () => playSound('vehicle_registered'),
        playNewConsumption: () => playSound('new_consumption'),
        playNewMessage: () => playSound('new_message'),
        isAudioReady,
        unlockAudio,
    };
}

/**
 * Hook original que combina el motor de sonido con oyentes de Supabase.
 */
export function useSoundNotifications(
    role: 'valet' | 'receptionist',
    roomsCache: { id: string; number: string }[]
) {
    const soundEngine = useSoundEngine();
    const roomsRef = useRef(roomsCache);
    const notifiedEntryStayIdsRef = useRef<Set<string>>(new Set());
    const notifiedConsumptionIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        roomsRef.current = roomsCache;
    }, [roomsCache]);

    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('room-notifications')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'room_stays' },
                async (payload: any) => {
                    const newData = payload.new as any;
                    let roomNumber = roomsRef.current.find(r => r.id === newData.room_id)?.number;
                    if (!roomNumber) {
                        const { data } = await supabase.from('rooms').select('number').eq('id', newData.room_id).single();
                        roomNumber = data?.number || '??';
                    }

                    if (role === 'valet') {
                        const stayId = String(newData.id ?? '');
                        if (stayId && newData.status === 'ACTIVA' && !newData.valet_employee_id && !notifiedEntryStayIdsRef.current.has(stayId)) {
                            notifiedEntryStayIdsRef.current.add(stayId);
                            setTimeout(() => notifiedEntryStayIdsRef.current.delete(stayId), 60_000);
                            soundEngine.playSound('new_entry');
                            toast.info(`🚗 Nueva entrada: Habitación ${roomNumber}`, { duration: 10000 });
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'room_stays' },
                async (payload: any) => {
                    const newData = payload.new as any;
                    const oldData = payload.old as any;
                    let roomNumber = roomsRef.current.find(r => r.id === newData.room_id)?.number;
                    if (!roomNumber) {
                        const { data } = await supabase.from('rooms').select('number').eq('id', newData.room_id).single();
                        roomNumber = data?.number || '??';
                    }

                    if (role === 'valet' && !oldData.vehicle_requested_at && newData.vehicle_requested_at) {
                        soundEngine.playSound('vehicle_request');
                        toast.error(`🚨 SOLICITUD DE AUTO: Habitación ${roomNumber}`, { duration: 10000 });
                    }

                    if (role === 'receptionist') {
                        if (!oldData.checkout_valet_employee_id && newData.checkout_valet_employee_id) {
                            // Buscar el nombre del cochero
                            let valetName = 'Cochero';
                            try {
                                const { data: emp } = await supabase
                                    .from('employees')
                                    .select('first_name')
                                    .eq('id', newData.checkout_valet_employee_id)
                                    .single();
                                if (emp?.first_name) valetName = emp.first_name;
                            } catch { /* fallback a 'Cochero' */ }

                            soundEngine.playSound('car_ready');
                            toast.success(`🚗 ${valetName} ha revisado la Hab. ${roomNumber}, puedes darle salida`, { duration: 12000 });
                        }
                        if (!oldData.valet_checkout_requested_at && newData.valet_checkout_requested_at) {
                            // Buscar el nombre del cochero
                            let valetName = 'Cochero';
                            try {
                                const valetId = newData.checkout_valet_employee_id;
                                if (valetId) {
                                    const { data: emp } = await supabase
                                        .from('employees')
                                        .select('first_name')
                                        .eq('id', valetId)
                                        .single();
                                    if (emp?.first_name) valetName = emp.first_name;
                                }
                            } catch { /* fallback a 'Cochero' */ }

                            soundEngine.playSound('checkout_request');
                            toast.warning(`🔔 ${valetName} solicita salida: Hab. ${roomNumber}`, { duration: 10000 });
                        }
                        if (!oldData.vehicle_plate && newData.vehicle_plate) {
                            soundEngine.playSound('vehicle_registered');
                            toast.info(`🚙 Nuevo vehículo registrado: Hab ${roomNumber}`);
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'sales_order_items' },
                async (payload: any) => {
                    const newData = payload.new as any;
                    if (role === 'valet' && newData.concept_type === 'CONSUMPTION' && !newData.delivery_accepted_by) {
                        const itemId = String(newData.id ?? '');
                        if (itemId && !notifiedConsumptionIdsRef.current.has(itemId)) {
                            notifiedConsumptionIdsRef.current.add(itemId);
                            setTimeout(() => notifiedConsumptionIdsRef.current.delete(itemId), 60_000);
                            try {
                                const { data: orderData } = await supabase
                                    .from('sales_orders')
                                    .select('room_stays(rooms(number))')
                                    .eq('id', newData.sales_order_id)
                                    .single();
                                const roomNumber = (orderData?.room_stays as any)?.rooms?.number || '??';
                                soundEngine.playSound('new_consumption');
                                toast.info(`🛎️ Nuevo consumo: Habitación ${roomNumber}`, { duration: 10000 });
                            } catch {
                                soundEngine.playSound('new_consumption');
                                toast.info(`🛎️ Nuevo consumo registrado`, { duration: 8000 });
                            }
                        }
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [role, soundEngine]);

    return soundEngine;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

type NotificationType = 'success' | 'alert' | 'info';
type SoundEvent = 'new_entry' | 'vehicle_request' | 'checkout_request' | 'car_ready' | 'vehicle_registered';

export function useSoundNotifications(
    role: 'valet' | 'receptionist',
    roomsCache: { id: string; number: string }[] // Para mapear room_id a número
) {
    const audioContextRef = useRef<AudioContext | null>(null);
    const roomsRef = useRef(roomsCache);
    const notifiedEntryStayIdsRef = useRef<Set<string>>(new Set());
    const [isAudioReady, setIsAudioReady] = useState(false);

    // Mantener cache actualizado sin reiniciar suscripción
    useEffect(() => {
        roomsRef.current = roomsCache;
    }, [roomsCache]);

    // Inicializar AudioContext (requiere interacción usuario, se resume en primer uso)
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
                    // resume() es async; en algunos navegadores solo funciona dentro de gesto
                    void ctx.resume();
                }
            } catch {
                // noop
            }

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
                // Ejecutar dentro del gesto de usuario (botón) para máxima compatibilidad
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
        } catch {
            return false;
        }
    }, []);

    const playTone = (type: NotificationType) => {
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
                // Tono: "Professional Chime" (Ding-Dong suave)
                // Chime más llamativo (arpegio corto con cola suave)
                // C5 (523.25), E5 (659.25), G5 (783.99)
                const freqs = [523.25, 659.25, 783.99];
                const offsets = [0, 0.09, 0.18];

                freqs.forEach((f, i) => {
                    const t = now + offsets[i];
                    scheduleTone(f, t, 0.28, t + 1.4, 'triangle');
                });

                // Subtono sutil para presencia (no debe ser molesto)
                scheduleTone(196, now, 0.06, now + 1.0, 'sine');

            } else if (type === 'success') {
                // Tono: "Glass Ping" (Acorde Mayor brillante)
                // C5 (523.25), E5 (659.25), G5 (783.99)
                const freqs = [523.25, 659.25, 783.99];

                freqs.forEach((f, i) => {
                    const t = now + (i * 0.05);
                    scheduleTone(f, t, 0.15, now + 1.5, 'triangle');
                });
            }
        };

        if (ctx.state === 'suspended') {
            // Intentar reanudar y reproducir después; si no se puede, se intentará en el próximo gesto
            void ctx.resume().then(play).catch(() => {
                // noop
            });
            return;
        }

        if (ctx.state !== 'running') return;

        setIsAudioReady(true);

        play();
    };

    const playSound = (event: SoundEvent) => {
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

            if (event === 'new_entry') {
                const freqs = [523.25, 659.25, 783.99];
                const offsets = [0, 0.09, 0.18];
                freqs.forEach((f, i) => {
                    const t = now + offsets[i];
                    scheduleTone(f, t, 0.30, t + 1.2, 'triangle');
                });
                scheduleTone(196, now, 0.05, now + 0.9, 'sine');
                return;
            }

            if (event === 'vehicle_request') {
                const base = 932.33; // A#5
                const hits = [0, 0.14, 0.28];
                hits.forEach((o) => {
                    const t = now + o;
                    scheduleTone(base, t, 0.22, t + 0.22, 'square');
                });
                scheduleTone(466.16, now, 0.04, now + 0.5, 'sine');
                return;
            }

            if (event === 'checkout_request') {
                const freqs = [392.0, 523.25];
                const offsets = [0, 0.16];
                freqs.forEach((f, i) => {
                    const t = now + offsets[i];
                    scheduleTone(f, t, 0.20, t + 1.0, 'triangle');
                });
                return;
            }

            if (event === 'car_ready') {
                playTone('success');
                return;
            }

            if (event === 'vehicle_registered') {
                scheduleTone(587.33, now, 0.10, now + 0.6, 'triangle');
                return;
            }
        };

        if (ctx.state === 'suspended') {
            void ctx.resume().then(play).catch(() => {
                // noop
            });
            return;
        }

        if (ctx.state !== 'running') return;
        setIsAudioReady(true);
        play();
    };

    useEffect(() => {
        const supabase = createClient();

        const channel = supabase
            .channel('room-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'room_stays',
                },
                (payload: any) => {
                    const newData = payload.new as any;
                    const roomNumber = roomsRef.current.find(r => r.id === newData.room_id)?.number || '??';

                    if (role === 'valet') {
                        const stayId = String(newData.id ?? '');
                        const isActiveStay = newData.status === 'ACTIVA';
                        const isUnassigned = !newData.valet_employee_id;
                        if (stayId && isActiveStay && isUnassigned && !notifiedEntryStayIdsRef.current.has(stayId)) {
                            notifiedEntryStayIdsRef.current.add(stayId);
                            setTimeout(() => {
                                notifiedEntryStayIdsRef.current.delete(stayId);
                            }, 60_000);

                            playSound('new_entry');
                            toast.info(`🚗 Nueva entrada: Habitación ${roomNumber}`, {
                                duration: 10000,
                                position: 'top-center',
                                style: { fontSize: '1.2rem', fontWeight: 'bold' }
                            });
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'room_stays',
                },
                (payload: any) => {
                    const newData = payload.new as any;
                    const oldData = payload.old as any;
                    // Usar roomsRef para buscar el número, evitando dependencias
                    const roomNumber = roomsRef.current.find(r => r.id === newData.room_id)?.number || '??';

                    // Lógica para VALET (Escuchar solicitudes de auto)
                    if (role === 'valet') {
                        if (!oldData.vehicle_requested_at && newData.vehicle_requested_at) {
                            playSound('vehicle_request');
                            toast.error(`🚨 SOLICITUD DE AUTO: Habitación ${roomNumber}`, {
                                duration: 10000,
                                position: 'top-center',
                                style: { fontSize: '1.2rem', fontWeight: 'bold' }
                            });
                        }
                    }

                    // Lógica para RECEPCION (Escuchar autos listos y solicitudes de salida)
                    if (role === 'receptionist') {
                        // Auto listo para entrega
                        if (!oldData.checkout_valet_employee_id && newData.checkout_valet_employee_id) {
                            playSound('car_ready');
                            toast.success(`🚗 Auto listo para entrega: Habitación ${roomNumber}`, {
                                duration: 5000,
                                position: 'top-right'
                            });
                        }
                        // Solicitud de salida (Valet en puerta)
                        if (!oldData.valet_checkout_requested_at && newData.valet_checkout_requested_at) {
                            playSound('checkout_request');
                            toast.warning(`🔔 SOLICITUD DE SALIDA: Habitación ${roomNumber}`, {
                                duration: 10000,
                                position: 'top-center',
                                style: { fontSize: '1.2rem', fontWeight: 'bold' }
                            });
                        }
                        // También escuchar nuevas entradas (vehículo registrado)
                        if (!oldData.vehicle_plate && newData.vehicle_plate) {
                            playSound('vehicle_registered');
                            toast.info(`🚙 Nuevo vehículo registrado: Hab ${roomNumber}`);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [role]); // Array de dependencias limpio

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
        isAudioReady,
        unlockAudio,
    };
}

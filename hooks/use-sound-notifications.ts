import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

type NotificationType = 'success' | 'alert' | 'info';

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

            if (type === 'alert') {
                // Tono: "Professional Chime" (Ding-Dong suave)
                // Chime más llamativo (arpegio corto con cola suave)
                // C5 (523.25), E5 (659.25), G5 (783.99)
                const freqs = [523.25, 659.25, 783.99];
                const offsets = [0, 0.09, 0.18];

                freqs.forEach((f, i) => {
                    const t = now + offsets[i];
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(f, t);

                    gain.gain.setValueAtTime(0, t);
                    gain.gain.linearRampToValueAtTime(0.28, t + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(t);
                    osc.stop(t + 1.5);
                });

                // Subtono sutil para presencia (no debe ser molesto)
                const sub = ctx.createOscillator();
                const subGain = ctx.createGain();
                sub.type = 'sine';
                sub.frequency.setValueAtTime(196, now); // G3
                subGain.gain.setValueAtTime(0, now);
                subGain.gain.linearRampToValueAtTime(0.06, now + 0.02);
                subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
                sub.connect(subGain);
                subGain.connect(ctx.destination);
                sub.start(now);
                sub.stop(now + 1.05);

            } else if (type === 'success') {
                // Tono: "Glass Ping" (Acorde Mayor brillante)
                // C5 (523.25), E5 (659.25), G5 (783.99)
                const freqs = [523.25, 659.25, 783.99];

                freqs.forEach((f, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle'; // Un poco más de brillo que sine
                    osc.frequency.setValueAtTime(f, now + (i * 0.05)); // Arpegio muy rápido

                    gain.gain.setValueAtTime(0, now + (i * 0.05));
                    gain.gain.linearRampToValueAtTime(0.15, now + (i * 0.05) + 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + (i * 0.05));
                    osc.stop(now + 1.5);
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

                            playTone('alert');
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
                            playTone('alert');
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
                            playTone('success');
                            toast.success(`🚗 Auto listo para entrega: Habitación ${roomNumber}`, {
                                duration: 5000,
                                position: 'top-right'
                            });
                        }
                        // Solicitud de salida (Valet en puerta)
                        if (!oldData.valet_checkout_requested_at && newData.valet_checkout_requested_at) {
                            playTone('alert');
                            toast.warning(`🔔 SOLICITUD DE SALIDA: Habitación ${roomNumber}`, {
                                duration: 10000,
                                position: 'top-center',
                                style: { fontSize: '1.2rem', fontWeight: 'bold' }
                            });
                        }
                        // También escuchar nuevas entradas (vehículo registrado)
                        if (!oldData.vehicle_plate && newData.vehicle_plate) {
                            // Info silenciosa o tono suave
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
        playSuccess: () => playTone('success'),
        playError: () => playTone('alert'),
        playAlert: () => playTone('alert'),
        isAudioReady,
        unlockAudio,
    };
}

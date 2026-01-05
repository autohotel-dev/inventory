import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

type NotificationType = 'success' | 'alert' | 'info';

export function useSoundNotifications(
    role: 'valet' | 'receptionist',
    roomsCache: { id: string; number: string }[] // Para mapear room_id a número
) {
    const audioContextRef = useRef<AudioContext | null>(null);
    const roomsRef = useRef(roomsCache);

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

    const playTone = (type: NotificationType) => {
        initAudio();
        const ctx = audioContextRef.current;
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;

        if (type === 'alert') {
            // Tono: "Professional Chime" (Ding-Dong suave)
            // Tono 1: G4 (392Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(392, now);

            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.3, now + 0.05); // Attack suave
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8); // Decay largo

            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 1);

            // Tono 2: E4 (329.63Hz) - Retardado
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(329.63, now + 0.6); // Entra después

            gain2.gain.setValueAtTime(0, now + 0.6);
            gain2.gain.linearRampToValueAtTime(0.3, now + 0.65);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.6);
            osc2.stop(now + 2.5);

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

    useEffect(() => {
        const supabase = createClient();

        const channel = supabase
            .channel('room-notifications')
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
        playAlert: () => playTone('alert')
    };
}

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

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'alert') {
            // Tono de alarma (Sirena)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.1);
            osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.2);
            osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);

            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'success') {
            // Tono de éxito (Ding)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

            osc.start();
            osc.stop(ctx.currentTime + 0.5);
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
                (payload) => {
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

                    // Lógica para RECEPCION (Escuchar autos listos)
                    if (role === 'receptionist') {
                        if (!oldData.checkout_valet_employee_id && newData.checkout_valet_employee_id) {
                            playTone('success');
                            toast.success(`🚗 Auto listo para entrega: Habitación ${roomNumber}`, {
                                duration: 5000,
                                position: 'top-right'
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

    return { playTone };
}

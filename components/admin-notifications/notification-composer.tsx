/**
 * Notification Composer Component
 * Allows staff to compose and send notifications to guests
 */

'use client';

import { useState, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type TargetType = 'room' | 'all';

interface ActiveRoom {
    room_number: string;
}

export function NotificationComposer() {
    const [targetType, setTargetType] = useState<TargetType>('room');
    const [roomNumber, setRoomNumber] = useState('');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);

    useEffect(() => {
        async function fetchActiveRooms() {
            setIsLoadingRooms(true);
            const supabase = createClient();
            const { data } = await supabase
                .from('guest_subscriptions')
                .select('room_number')
                .eq('is_active', true)
                .order('room_number');

            if (data) {
                // Deduplicate rooms
                // @ts-ignore
                const uniqueRooms = Array.from(new Set(data.map((item: any) => item.room_number)))
                    .map(num => ({ room_number: num }));
                setActiveRooms(uniqueRooms as any);
            }
            setIsLoadingRooms(false);
        }

        fetchActiveRooms();
    }, []);

    async function handleSend() {
        if (!title || !body) {
            setMessage({ type: 'error', text: 'El título y el mensaje son requeridos' });
            return;
        }

        if (targetType === 'room' && !roomNumber) {
            setMessage({ type: 'error', text: 'Debes seleccionar una habitación' });
            return;
        }

        setIsSending(true);
        setMessage(null);

        try {
            const response = await fetch('/api/guest/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_type: targetType,
                    target_id: targetType === 'room' ? roomNumber : null,
                    title,
                    body,
                    notification_type: 'custom',
                }),
            });

            if (response.ok) {
                setMessage({ type: 'success', text: '¡Notificación enviada exitosamente!' });
                setTitle('');
                setBody('');
                setRoomNumber('');
            } else {
                throw new Error('Error al enviar notificación');
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al enviar la notificación' });
        } finally {
            setIsSending(false);
        }
    }

    return (
        <div className="bg-neutral-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6">
                Enviar Notificación
            </h2>

            {/* Target Type */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-400 mb-3">
                    Destinatario
                </label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="radio"
                            value="room"
                            checked={targetType === 'room'}
                            onChange={(e) => setTargetType(e.target.value as TargetType)}
                            className="w-4 h-4 text-brand-red focus:ring-brand-red bg-neutral-800 border-white/10"
                        />
                        <span className="text-white group-hover:text-brand-red transition-colors">Habitación específica</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="radio"
                            value="all"
                            checked={targetType === 'all'}
                            onChange={(e) => setTargetType(e.target.value as TargetType)}
                            className="w-4 h-4 text-brand-red focus:ring-brand-red bg-neutral-800 border-white/10"
                        />
                        <span className="text-white group-hover:text-brand-red transition-colors">Todos los huéspedes</span>
                    </label>
                </div>
            </div>

            {/* Room Selection */}
            {targetType === 'room' && (
                <div className="mb-6">
                    <label className="block text-sm font-medium text-neutral-400 mb-2">
                        Seleccionar Habitación
                    </label>
                    {isLoadingRooms ? (
                        <div className="w-full px-4 py-3 border border-white/10 rounded-xl bg-neutral-950/50 text-neutral-500 italic">
                            Cargando habitaciones...
                        </div>
                    ) : activeRooms.length === 0 ? (
                        <div className="w-full px-4 py-3 border border-red-500/20 rounded-xl bg-red-500/5 text-red-400 text-sm">
                            No hay huéspedes suscritos.
                        </div>
                    ) : (
                        <select
                            value={roomNumber}
                            onChange={(e) => setRoomNumber(e.target.value)}
                            className="w-full px-4 py-3 border border-white/10 rounded-xl bg-neutral-950/50 text-white focus:outline-none focus:border-brand-red/50 focus:ring-1 focus:ring-brand-red/50 transition-all appearance-none cursor-pointer"
                        >
                            <option value="" className="bg-neutral-900 text-neutral-400">Seleccionar...</option>
                            {activeRooms.map((room) => (
                                <option key={room.room_number} value={room.room_number} className="bg-neutral-900 text-white">
                                    Habitación {room.room_number}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            )}

            {/* Title */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Título
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 border border-white/10 rounded-xl bg-neutral-950/50 text-white placeholder-neutral-600 focus:outline-none focus:border-brand-red/50 focus:ring-1 focus:ring-brand-red/50 transition-all"
                    placeholder="Ej: Promoción especial"
                />
            </div>

            {/* Body */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                    Mensaje
                </label>
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full px-4 py-3 border border-white/10 rounded-xl bg-neutral-950/50 text-white placeholder-neutral-600 focus:outline-none focus:border-brand-red/50 focus:ring-1 focus:ring-brand-red/50 transition-all"
                    rows={4}
                    placeholder="Escribe tu mensaje aquí..."
                />
            </div>

            {/* Message */}
            {message && (
                <div
                    className={`mb-4 p-4 rounded-lg ${message.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                        }`}
                >
                    {message.text}
                </div>
            )}

            {/* Send Button */}
            <button
                onClick={handleSend}
                disabled={isSending}
                className="w-full bg-brand-red hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
                {isSending ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Enviando...</span>
                    </>
                ) : (
                    <>
                        <Send className="w-5 h-5" />
                        <span>Enviar Notificación</span>
                    </>
                )}
            </button>
        </div>
    );
}

/**
 * Notification Composer Component
 * Allows staff to compose and send notifications to guests
 */

'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

type TargetType = 'room' | 'all';

export function NotificationComposer() {
    const [targetType, setTargetType] = useState<TargetType>('room');
    const [roomNumber, setRoomNumber] = useState('');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    async function handleSend() {
        if (!title || !body) {
            setMessage({ type: 'error', text: 'El título y el mensaje son requeridos' });
            return;
        }

        if (targetType === 'room' && !roomNumber) {
            setMessage({ type: 'error', text: 'El número de habitación es requerido' });
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
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Enviar Notificación
            </h2>

            {/* Target Type */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Destinatario
                </label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            value="room"
                            checked={targetType === 'room'}
                            onChange={(e) => setTargetType(e.target.value as TargetType)}
                            className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-gray-900 dark:text-white">Habitación específica</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            value="all"
                            checked={targetType === 'all'}
                            onChange={(e) => setTargetType(e.target.value as TargetType)}
                            className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-gray-900 dark:text-white">Todos los huéspedes</span>
                    </label>
                </div>
            </div>

            {/* Room Number */}
            {targetType === 'room' && (
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Número de Habitación
                    </label>
                    <input
                        type="text"
                        value={roomNumber}
                        onChange={(e) => setRoomNumber(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ej: 101"
                    />
                </div>
            )}

            {/* Title */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Título
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Promoción especial"
                />
            </div>

            {/* Body */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mensaje
                </label>
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
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

/**
 * Notification Subscribe Component
 * Allows guests to subscribe to push notifications
 */

'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import {
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
    getSubscriptionStatus,
    isPushNotificationSupported,
} from '@/lib/services/push-notification-service';

interface NotificationSubscribeProps {
    roomStayId: string;
    roomNumber: string;
}

export function NotificationSubscribe({
    roomStayId,
    roomNumber,
}: NotificationSubscribeProps) {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSupported, setIsSupported] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        // Check if push notifications are supported
        if (!isPushNotificationSupported()) {
            setIsSupported(false);
            return;
        }

        // Check current subscription status
        checkSubscription();
    }, []);

    async function checkSubscription() {
        const status = await getSubscriptionStatus();
        setIsSubscribed(status.isSubscribed);
    }

    async function handleSubscribe() {
        setIsLoading(true);
        setMessage(null);

        const result = await subscribeToPushNotifications(roomStayId, roomNumber);

        if (result.success) {
            setIsSubscribed(true);
            setSubscriptionId(result.subscriptionId || null);
            setMessage({
                type: 'success',
                text: '¡Suscripción exitosa! Recibirás notificaciones importantes.',
            });
        } else {
            setMessage({
                type: 'error',
                text: result.error || 'Error al suscribirse. Intenta de nuevo.',
            });
        }

        setIsLoading(false);
    }

    async function handleUnsubscribe() {
        if (!subscriptionId) return;

        setIsLoading(true);
        setMessage(null);

        const result = await unsubscribeFromPushNotifications(subscriptionId);

        if (result.success) {
            setIsSubscribed(false);
            setSubscriptionId(null);
            setMessage({
                type: 'success',
                text: 'Te has desuscrito de las notificaciones.',
            });
        } else {
            setMessage({
                type: 'error',
                text: result.error || 'Error al desuscribirse.',
            });
        }

        setIsLoading(false);
    }

    if (!isSupported) {
        return (
            <div className="bg-yellow-950/30 backdrop-blur-sm rounded-2xl p-6 border border-yellow-500/20">
                <div className="flex items-start gap-4">
                    <div className="bg-yellow-500/20 rounded-lg p-3">
                        <Bell className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-2">
                            Notificaciones no disponibles
                        </h3>
                        <p className="text-white/70 text-sm">
                            Tu navegador no soporta notificaciones push. Intenta con Chrome, Firefox o Edge.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-xl">
            <div className="flex items-start gap-4 mb-6">
                <div className="bg-brand-red/10 rounded-xl p-4 border border-brand-red/20">
                    {isSubscribed ? (
                        <Check className="w-8 h-8 text-green-500" />
                    ) : (
                        <Bell className="w-8 h-8 text-brand-red" />
                    )}
                </div>
                <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-2">
                        {isSubscribed ? '¡Estás suscrito!' : 'Recibe Notificaciones'}
                    </h3>
                    <p className="text-white/60">
                        {isSubscribed
                            ? 'Recibirás recordatorios y promociones durante tu estancia.'
                            : 'Activa las notificaciones para recibir recordatorios de check-out, ofertas especiales y encuestas.'}
                    </p>
                </div>
            </div>

            {/* Benefits */}
            {!isSubscribed && (
                <div className="mb-6 space-y-2">
                    <div className="flex items-center gap-3 text-white/80 text-sm">
                        <div className="w-2 h-2 bg-brand-red rounded-full"></div>
                        <span>Recordatorios de check-out</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/80 text-sm">
                        <div className="w-2 h-2 bg-brand-red rounded-full"></div>
                        <span>Promociones exclusivas de servicios</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/80 text-sm">
                        <div className="w-2 h-2 bg-brand-red rounded-full"></div>
                        <span>Encuestas de satisfacción</span>
                    </div>
                </div>
            )}

            {/* Message */}
            {message && (
                <div
                    className={`mb-4 p-4 rounded-lg border ${message.type === 'success'
                        ? 'bg-green-500/10 border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}
                >
                    <p className="text-sm font-medium">{message.text}</p>
                </div>
            )}

            {/* Action Button */}
            <button
                onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
                disabled={isLoading}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all ${isSubscribed
                    ? 'bg-neutral-800 hover:bg-neutral-700 border border-white/10'
                    : 'bg-brand-red hover:bg-red-600 shadow-lg shadow-brand-red/20 hover:shadow-brand-red/40'
                    } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3`}
            >
                {isLoading ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Procesando...</span>
                    </>
                ) : isSubscribed ? (
                    <>
                        <BellOff className="w-5 h-5" />
                        <span>Desactivar Notificaciones</span>
                    </>
                ) : (
                    <>
                        <Bell className="w-5 h-5" />
                        <span>Activar Notificaciones</span>
                    </>
                )}
            </button>
        </div>
    );
}

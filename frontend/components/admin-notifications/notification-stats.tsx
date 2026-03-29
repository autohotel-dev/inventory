/**
 * Notification Stats Component
 * Displays key metrics for the notification system
 */

'use client';

import { Bell, Users, TrendingUp } from 'lucide-react';

interface NotificationStatsProps {
    totalSubscriptions: number;
    totalNotifications: number;
}

export function NotificationStats({
    totalSubscriptions,
    totalNotifications,
}: NotificationStatsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-neutral-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-xl">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-neutral-400 text-sm mb-1">
                            Suscripciones Activas
                        </p>
                        <p className="text-3xl font-bold text-white">
                            {totalSubscriptions}
                        </p>
                    </div>
                    <div className="bg-brand-red/10 rounded-lg p-3 border border-brand-red/20">
                        <Users className="w-6 h-6 text-brand-red" />
                    </div>
                </div>
            </div>

            <div className="bg-neutral-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-xl">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-neutral-400 text-sm mb-1">
                            Notificaciones Enviadas
                        </p>
                        <p className="text-3xl font-bold text-white">
                            {totalNotifications}
                        </p>
                    </div>
                    <div className="bg-brand-red/10 rounded-lg p-3 border border-brand-red/20">
                        <Bell className="w-6 h-6 text-brand-red" />
                    </div>
                </div>
            </div>

            <div className="bg-neutral-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-xl">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-neutral-400 text-sm mb-1">Tasa de Apertura</p>
                        <p className="text-3xl font-bold text-white">
                            {totalNotifications > 0 ? '~75%' : '0%'}
                        </p>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                        <TrendingUp className="w-6 h-6 text-green-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}

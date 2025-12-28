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
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                            Suscripciones Activas
                        </p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {totalSubscriptions}
                        </p>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-3">
                        <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                            Notificaciones Enviadas
                        </p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {totalNotifications}
                        </p>
                    </div>
                    <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-3">
                        <Bell className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Tasa de Apertura</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {totalNotifications > 0 ? '~75%' : '0%'}
                        </p>
                    </div>
                    <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
                        <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                </div>
            </div>
        </div>
    );
}

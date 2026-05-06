/**
 * Notifications Admin Dashboard
 * Main page for managing guest notifications
 */

import { redirect } from 'next/navigation';
import { NotificationComposer } from '@/components/admin-notifications/notification-composer';
import { GuestList } from '@/components/admin-notifications/guest-list';
import { NotificationStats } from '@/components/admin-notifications/notification-stats';

export default function NotificationsAdminPage() {
    // Stats will be fetched client-side by NotificationStats component
    // Auth check is handled by middleware

    return (
        <div className="min-h-screen bg-neutral-950 p-2 sm:p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-xl sm:text-3xl font-bold text-white mb-2">
                        Panel de Notificaciones
                    </h1>
                    <p className="text-neutral-400">
                        Gestiona las notificaciones para los huéspedes del hotel
                    </p>
                </div>

                {/* Stats */}
                <NotificationStats
                    totalSubscriptions={0}
                    totalNotifications={0}
                />

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-6">
                    {/* Composer */}
                    <div className="lg:col-span-2">
                        <NotificationComposer />
                    </div>

                    {/* Guest List */}
                    <div className="lg:col-span-1">
                        <GuestList />
                    </div>
                </div>
            </div>
        </div>
    );
}

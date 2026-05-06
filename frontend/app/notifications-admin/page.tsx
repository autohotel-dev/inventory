/**
 * Notifications Admin Dashboard
 * Main page for managing guest notifications
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NotificationComposer } from '@/components/admin-notifications/notification-composer';
import { GuestList } from '@/components/admin-notifications/guest-list';
import { NotificationStats } from '@/components/admin-notifications/notification-stats';

export default async function NotificationsAdminPage() {
    const supabase = await createClient();

    // Check authentication
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect('/auth/login');
    }

    // Check if user is staff
    const { data: employee } = await supabase
        .from('employees')
        .select('role')
        
        ;

    if (!employee || !['admin', 'manager', 'recepcionista'].includes(employee.role)) {
        redirect('/dashboard');
    }

    // Fetch statistics
    const { count: totalSubscriptions } = await supabase
        .from('guest_subscriptions')
        .select('*', { count: 'exact', head: true })
        ;

    const { count: totalNotifications } = await supabase
        .from('guest_notifications')
        .select('*', { count: 'exact', head: true });

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
                    totalSubscriptions={totalSubscriptions || 0}
                    totalNotifications={totalNotifications || 0}
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

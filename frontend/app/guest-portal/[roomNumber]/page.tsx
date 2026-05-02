/**
 * Guest Portal Page
 * Main landing page for hotel guests
 * Accessible via /guest-portal/[roomNumber]
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import {
    WelcomeSection,
    NotificationSubscribe,
    ServicesShowcase,
    SurveyViewer,
    NotificationListener,
    FeedbackForm
} from '@/components/guest';

interface PageProps {
    params: Promise<{
        roomNumber: string;
    }>;
    searchParams: Promise<{
        token?: string;
    }>;
}

export default async function GuestPortalPage({ params, searchParams }: PageProps) {
    const { roomNumber } = await params;
    const { token } = await searchParams;

    // Token is required for security
    if (!token) {
        notFound();
    }

    const supabase = createAdminClient();

    // First, get the room ID from the room number
    const { data: room } = await supabase
        .from('rooms')
        .select('id')
        .eq('number', roomNumber)
        .single();

    if (!room) {
        notFound();
    }

    // Fetch active room stay for this room WITH valid token
    const { data: roomStay, error } = await supabase
        .from('room_stays')
        .select(`
      id,
      check_in_at,
      expected_check_out_at,
      current_people,
      total_people,
      guest_access_token,
      rooms (
        id,
        number,
        room_types (
          name,
          is_hotel
        )
      ),
      sales_orders (
        customers (
          name
        )
      )
    `)
        .eq('room_id', room.id)
        .eq('status', 'ACTIVA')
        .eq('guest_access_token', token)
        .maybeSingle();

    if (error || !roomStay) {
        if (error) console.error("Guest Portal Error:", error);
        notFound(); // Invalid token or room stay not found
    }

    // Fetch active surveys
    const { data: surveys } = await supabase
        .from('surveys')
        .select('*')
        .eq('is_active', true)
        .in('target_audience', ['all', 'specific']);

    return (
        <div className="min-h-screen bg-neutral-950 text-white selection:bg-brand-red selection:text-white relative overflow-x-hidden">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-brand-red/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-brand-red/5 rounded-full blur-[100px]" />
            </div>

            {/* Header */}
            <header className="bg-neutral-950/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">Portal de Huéspedes</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse" />
                                <p className="text-neutral-400 text-xs font-medium">Habitación <span className="text-white font-mono">{roomNumber}</span></p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-neutral-800 to-neutral-900 border border-white/5 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-brand-red text-lg">🏨</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative z-10 max-w-6xl mx-auto px-4 py-8 space-y-8">
                {/* Welcome Section */}
                <WelcomeSection roomStay={roomStay} />

                {/* Notification Subscription */}
                <NotificationSubscribe roomStayId={roomStay.id} roomNumber={roomNumber} />

                {/* Services */}
                <ServicesShowcase />

                {/* Feedback */}
                <FeedbackForm roomNumber={roomNumber} stayId={roomStay.id} />

                {/* Surveys */}
                {surveys && surveys.length > 0 && (
                    <SurveyViewer
                        surveys={surveys}
                        roomStayId={roomStay.id}
                        roomNumber={roomNumber}
                    />
                )}
            </main>

            <NotificationListener />

            {/* Footer */}
            <footer className="relative z-10 bg-neutral-950 border-t border-white/5 mt-20">
                <div className="max-w-6xl mx-auto px-4 py-12">
                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-12 h-1 bg-white/5 rounded-full mb-4" />
                        <p className="text-neutral-500 text-sm">© 2025 Hotel. Todos los derechos reservados.</p>
                        <p className="text-neutral-600 text-xs">Sistema de gestión inteligente</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

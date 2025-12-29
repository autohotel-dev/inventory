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

    console.log("--- GUEST PORTAL DEBUG ---");
    console.log("Room Number:", roomNumber);
    console.log("Token:", token);
    console.log("Has Service Key:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Token is required for security
    if (!token) {
        console.log("Error: No token provided");
        notFound();
    }

    const supabase = createAdminClient();

    // First, get the room ID from the room number
    const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .eq('number', roomNumber)
        .single();

    if (roomError) console.log("Room Fetch Error:", roomError.message);
    console.log("Room Found:", room?.id);

    if (!room) {
        console.log("Error: Room not found in DB");
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
        customer_name
      )
    `)
        .eq('room_id', room.id)
        .eq('status', 'ACTIVA')
        .eq('guest_access_token', token)
        .maybeSingle();

    if (error) console.log("Stay Fetch Error:", error.message);
    console.log("Stay Found:", roomStay?.id);

    if (error || !roomStay) {
        console.log("Error: Stay not found or token mismatch");
        notFound(); // Invalid token or room stay not found
    }

    // Fetch active surveys
    const { data: surveys } = await supabase
        .from('surveys')
        .select('*')
        .eq('is_active', true)
        .in('target_audience', ['all', 'specific']);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            {/* Header */}
            <header className="bg-slate-900/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Portal de Huéspedes</h1>
                            <p className="text-blue-300 text-sm">Habitación {roomNumber}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                                <span className="text-white text-xl">🏨</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
                {/* Welcome Section */}
                <WelcomeSection roomStay={roomStay} />

                {/* Notification Subscription */}
                <NotificationSubscribe roomStayId={roomStay.id} roomNumber={roomNumber} />

                {/* Services */}
                <ServicesShowcase />

                {/* Surveys */}
                {surveys && surveys.length > 0 && (
                    <SurveyViewer
                        surveys={surveys}
                        roomStayId={roomStay.id}
                        roomNumber={roomNumber}
                    />
                )}
            </main>

            {/* Footer */}
            <footer className="bg-slate-900/50 backdrop-blur-md border-t border-white/10 mt-16">
                <div className="max-w-6xl mx-auto px-4 py-8 text-center text-white/60">
                    <p>© 2025 Hotel. Todos los derechos reservados.</p>
                    <p className="text-sm mt-2">Sistema de gestión de huéspedes</p>
                </div>
            </footer>
        </div>
    );
}

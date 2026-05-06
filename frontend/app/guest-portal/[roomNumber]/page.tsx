/**
 * Guest Portal Page
 * Main landing page for hotel guests
 * Accessible via /guest-portal/[roomNumber]
 */

import { notFound } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
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

    try {
        // First, get the room ID from the room number
        const { data: roomData } = await apiClient.get('/system/crud/rooms', { 
            params: { number: roomNumber } 
        });
        const rooms = Array.isArray(roomData) ? roomData : (roomData?.items || roomData?.results || []);
        const room = rooms[0];

        if (!room) {
            notFound();
        }

        // Fetch active room stay for this room WITH valid token
        const { data: roomStayData } = await apiClient.get('/system/crud/room_stays', {
            params: { 
                room_id: room.id,
                guest_access_token: token,
                status: 'ACTIVA'
            }
        });
        
        const stays = Array.isArray(roomStayData) ? roomStayData : (roomStayData?.items || roomStayData?.results || []);
        const roomStayRaw = stays[0];

        if (!roomStayRaw) {
            notFound(); // Invalid token or room stay not found
        }
        
        // Ensure the nested structure matches what the frontend expects
        // Normally the FastAPI backend would return these nested relationships,
        // but we make sure they are at least safely accessible
        const roomStay = {
            ...roomStayRaw,
            rooms: roomStayRaw.rooms || room,
        };

        // Fetch active surveys
        const { data: surveysData } = await apiClient.get('/system/crud/surveys', {
            params: { is_active: true }
        });
        let surveys = Array.isArray(surveysData) ? surveysData : (surveysData?.items || surveysData?.results || []);
        
        // Filter for all or specific audience
        surveys = surveys.filter((s: any) => ['all', 'specific'].includes(s.target_audience));

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
    } catch (error) {
        console.error("Guest Portal Error:", error);
        notFound();
    }
}

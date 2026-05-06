/**
 * Guest List Component
 * Shows currently subscribed guests
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BellRing, Loader2 } from 'lucide-react';

interface GuestSubscription {
    id: string;
    room_number: string;
    subscribed_at: string;
    last_notified_at: string | null;
}

export function GuestList() {
    const [guests, setGuests] = useState<GuestSubscription[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchGuests();
    }, []);

    async function fetchGuests() {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('guest_subscriptions')
            .select('*')
            
            
            .limit(10);

        if (!error && data) {
            setGuests(data);
        }
        setIsLoading(false);
    }

    // Realtime subscription
    useEffect(() => {
        const supabase = createClient();

        const channel = supabase
            .channel('guest_subscriptions_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'guest_subscriptions'
                },
                (payload: any) => {
                    console.log('Realtime change:', payload);

                    if (payload.eventType === 'INSERT') {
                        const newGuest = payload.new as GuestSubscription;
                        // Only add if active (although robust logic might filter backend view)
                        // payload.new might include other fields, but we cast for safely
                        setGuests(prev => [newGuest, ...prev].slice(0, 10)); // Keep top 10
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedGuest = payload.new as GuestSubscription & { is_active: boolean };

                        if (!updatedGuest.is_active) {
                            // Helper to remove if deactivated
                            setGuests(prev => prev.filter(g => g.id !== updatedGuest.id));
                        } else {
                            // Update existing (maybe re-activated?) or just modified
                            // Check if it already exists
                            setGuests(prev => {
                                const exists = prev.find(g => g.id === updatedGuest.id);
                                if (exists) {
                                    return prev.map(g => g.id === updatedGuest.id ? updatedGuest : g);
                                } else {
                                    return [updatedGuest, ...prev].sort((a, b) =>
                                        new Date(b.subscribed_at).getTime() - new Date(a.subscribed_at).getTime()
                                    ).slice(0, 10);
                                }
                            });
                        }
                    } else if (payload.eventType === 'DELETE') {
                        const deletedId = payload.old.id;
                        setGuests(prev => prev.filter(g => g.id !== deletedId));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <div className="bg-neutral-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-2xl h-full">
            <h2 className="text-xl font-bold text-white mb-6">
                Huéspedes Suscritos
            </h2>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-brand-red animate-spin" />
                </div>
            ) : guests.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    No hay huéspedes suscritos actualmente
                </div>
            ) : (
                <div className="space-y-3">
                    {guests.map((guest) => (
                        <div
                            key={guest.id}
                            className="bg-neutral-950/50 border border-white/5 rounded-xl p-4 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-brand-red/10 rounded-lg p-2">
                                    <BellRing className="w-4 h-4 text-brand-red" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white">
                                        Habitación {guest.room_number}
                                    </p>
                                    <p className="text-xs text-neutral-500">
                                        Suscrito:{' '}
                                        {new Date(guest.subscribed_at).toLocaleDateString('es-MX', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                            </div>
                            <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

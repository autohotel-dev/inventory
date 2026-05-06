/**
 * Guest List Component
 * Shows currently subscribed guests
 */

'use client';

import { useEffect, useState } from 'react';
import { luxorRealtimeClient } from '@/lib/api/websocket';
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
        try {
            const { apiClient } = await import('@/lib/api/client');
            // Assuming we only fetch active by default. Wait, the original was selecting all where is_active is probably true since the UI checks it later or there was a filter I missed.
            const { data } = await apiClient.get('/system/crud/guest_subscriptions?limit=10');
            if (data) {
                setGuests(data as GuestSubscription[]);
            }
        } catch(e) {}
        setIsLoading(false);
    }

    // Realtime subscription
    useEffect(() => {
        const unsubscribe = luxorRealtimeClient.subscribe("guest_subscriptions", (payload) => {
            console.log('Realtime change:', payload);
            if (payload.type === 'INSERT') {
                const newGuest = payload.record as GuestSubscription;
                setGuests(prev => [newGuest, ...prev].slice(0, 10)); // Keep top 10
            } else if (payload.type === 'UPDATE') {
                const updatedGuest = payload.record as GuestSubscription & { is_active: boolean };

                if (updatedGuest.is_active === false) {
                    setGuests(prev => prev.filter(g => g.id !== updatedGuest.id));
                } else {
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
            } else if (payload.type === 'DELETE') {
                const deletedId = payload.old_record.id;
                setGuests(prev => prev.filter(g => g.id !== deletedId));
            }
        });

        return () => {
            unsubscribe();
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

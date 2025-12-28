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
            .eq('is_active', true)
            .order('subscribed_at', { ascending: false })
            .limit(10);

        if (!error && data) {
            setGuests(data);
        }
        setIsLoading(false);
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Huéspedes Suscritos
            </h2>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
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
                            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2">
                                    <BellRing className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                        Habitación {guest.room_number}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
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
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

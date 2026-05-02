"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export interface PresenceState {
    user_id: string;
    email: string;
    is_typing: boolean;
    online_at: string;
}

export function useChatPresence(
    currentUser: { id: string; email?: string } | null
) {
    const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
    const [typingUsers, setTypingUsers] = useState<PresenceState[]>([]);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const supabase = useMemo(() => createClient(), []);

    // Initialize Presence Channel
    useEffect(() => {
        if (!currentUser) return;

        const newChannel = supabase.channel('presence:global', {
            config: {
                presence: {
                    key: currentUser.id,
                },
            },
        });

        const updateState = () => {
            const state = newChannel.presenceState();
            const users: PresenceState[] = [];

            for (const key in state) {
                users.push(...(state[key] as any));
            }

            // Deduplicate by user_id
            const uniqueUsers = Array.from(new Map(users.map(u => [u.user_id, u])).values());
            setOnlineUsers(uniqueUsers);
            setTypingUsers(uniqueUsers.filter(u => u.is_typing && u.user_id !== currentUser.id));
        };

        newChannel
            .on('presence', { event: 'sync' }, updateState)
            .on('presence', { event: 'join' }, updateState)
            .on('presence', { event: 'leave' }, updateState)
            .subscribe(async (status: any) => {
                if (status === 'SUBSCRIBED') {
                    try {
                        await newChannel.track({
                            user_id: currentUser.id,
                            email: currentUser.email || 'Anónimo',
                            is_typing: false,
                            online_at: new Date().toISOString(),
                        });
                    } catch {
                        // Channel may have been removed during subscribe — safe to ignore
                    }
                }
            });

        channelRef.current = newChannel;

        return () => {
            channelRef.current = null;
            supabase.removeChannel(newChannel);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id]);

    const setTyping = useCallback(async (isTyping: boolean) => {
        const channel = channelRef.current;
        if (!channel || !currentUser) return;

        try {
            await channel.track({
                user_id: currentUser.id,
                email: currentUser.email || 'Anónimo',
                is_typing: isTyping,
                online_at: new Date().toISOString(),
            });
        } catch {
            // Channel disconnected — safe to ignore
        }
    }, [currentUser]);

    // Helper to trigger typing with auto-reset
    const handleTypingInput = useCallback(() => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        } else {
            setTyping(true);
        }

        // Stop typing after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            setTyping(false);
            typingTimeoutRef.current = null;
        }, 2000);
    }, [setTyping]);

    return {
        onlineUsers,
        typingUsers,
        handleTypingInput
    };
}

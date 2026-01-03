"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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
    const [channel, setChannel] = useState<RealtimeChannel | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize Presence Channel
    useEffect(() => {
        if (!currentUser) return;

        const supabase = createClient();
        const newChannel = supabase.channel('presence:global', {
            config: {
                presence: {
                    key: currentUser.id,
                },
            },
        });

        const updateState = () => {
            const state = newChannel.presenceState<PresenceState>();
            const users: PresenceState[] = [];

            // Flatten state (Supabase returns object with keys per presence ref)
            for (const key in state) {
                users.push(...state[key]);
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
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await newChannel.track({
                        user_id: currentUser.id,
                        email: currentUser.email || 'Anónimo',
                        is_typing: false,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        setChannel(newChannel);

        return () => {
            supabase.removeChannel(newChannel);
        };
    }, [currentUser?.id]); // Only re-run if user ID changes to avoid constant reconnections

    const setTyping = useCallback(async (isTyping: boolean) => {
        if (!channel || !currentUser) return;

        // Track state with debounce/safety
        await channel.track({
            user_id: currentUser.id,
            email: currentUser.email || 'Anónimo',
            is_typing: isTyping,
            online_at: new Date().toISOString(),
        });

    }, [channel, currentUser]);

    // Helper to trigger typing with auto-reset
    const handleTypingInput = useCallback(() => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        } else {
            // Start typing
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

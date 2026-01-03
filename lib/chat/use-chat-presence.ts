"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface PresenceState {
    user_id: string;
    email: string;
    is_typing: boolean;
    online_at: string;
}

export function useChatPresence(
    channel: RealtimeChannel | null,
    currentUser: { id: string; email?: string } | null
) {
    const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
    const [typingUsers, setTypingUsers] = useState<PresenceState[]>([]);

    // Track typing timeout to clear status
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!channel || !currentUser) return;

        const updateState = () => {
            const state = channel.presenceState<PresenceState>();
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

        channel
            .on('presence', { event: 'sync' }, updateState)
            .on('presence', { event: 'join' }, updateState)
            .on('presence', { event: 'leave' }, updateState);

        // Initial track
        channel.track({
            user_id: currentUser.id,
            email: currentUser.email || 'Anónimo',
            is_typing: false,
            online_at: new Date().toISOString(),
        });

    }, [channel, currentUser]);

    const setTyping = useCallback(async (isTyping: boolean) => {
        if (!channel || !currentUser) return;

        // Debounce tracking calls if needed, but simply tracking state change is usually fine
        // provided we don't spam it on every keystroke.
        // We will manage the "stop typing" logic in the UI component calling this, 
        // or we handle the timeout here.

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

"use client";

import { useState, useCallback, useRef } from 'react';

export interface PresenceState {
    user_id: string;
    email: string;
    is_typing: boolean;
    online_at: string;
}

export function useChatPresence(
    currentUser: { id: string; email?: string } | null
) {
    const [onlineUsers] = useState<PresenceState[]>([]);
    const [typingUsers, setTypingUsers] = useState<PresenceState[]>([]);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleTypingInput = useCallback(() => {
        // Presence is disabled in this version while we migrate to FastAPI WebSockets completely.
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            typingTimeoutRef.current = null;
        }, 2000);
    }, []);

    return {
        onlineUsers,
        typingUsers,
        handleTypingInput
    };
}

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Conversation } from './chat-types';

export interface EnrichedConversation {
    id: string;
    type: 'direct' | 'group' | 'global';
    created_at: string;
    updated_at: string;
    participants: { user_id: string }[];
    last_message?: {
        content: string;
        created_at: string;
        user_email: string;
        message_type: string;
    };
    // Resolved participant name for direct conversations
    other_user_name?: string;
    other_user_id?: string;
}

export function useConversations(currentUser: any) {
    const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = useMemo(() => createClient(), []);

    const fetchConversations = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);

        try {
            // TODO: Migrate to FastAPI chat endpoints
            setConversations([]);
        } catch {
            // Silently handle
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id]);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    const startDirectConversation = async (otherUserId: string) => {
        if (!currentUser) return null;

        try {
            // TODO: Migrate to FastAPI
            return null;
        } catch {
            return null;
        }
    };

    return {
        conversations,
        isLoading,
        startDirectConversation,
        refresh: fetchConversations
    };
}

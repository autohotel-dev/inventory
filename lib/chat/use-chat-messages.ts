"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatMessage } from './chat-types';

const PAGE_SIZE = 50;

export function useChatMessages() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const supabase = createClient();

    // Keep track of the earliest loaded message time for pagination
    const oldestMessageTimeRef = useRef<string | null>(null);

    const fetchMessages = useCallback(async (loadMore = false) => {
        if (loadMore && !hasMore) return;
        if (!loadMore) setIsLoading(true);

        let query = supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false }) // Get newest first for pagination logic
            .limit(PAGE_SIZE);

        if (loadMore && oldestMessageTimeRef.current) {
            query = query.lt('created_at', oldestMessageTimeRef.current);
        }

        const { data, error } = await query;

        if (!error && data) {
            // Reverse back to chronological order for display
            const newMessages = [...data].reverse() as ChatMessage[];

            if (newMessages.length > 0) {
                oldestMessageTimeRef.current = newMessages[0].created_at; // Update oldest
            }

            if (data.length < PAGE_SIZE) {
                setHasMore(false);
            }

            setMessages(prev => loadMore ? [...newMessages, ...prev] : newMessages);
        }
        setIsLoading(false);
    }, [supabase, hasMore]);


    const sendMessage = async (content: string, user: any) => {
        if (!content.trim() || !user) return;

        // Optimistic Update
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: ChatMessage = {
            id: tempId,
            content,
            user_id: user.id,
            user_email: user.email,
            is_admin: false, // Server will decide, but for UI we assume generic until confirmed
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticMessage]);

        // We don't send is_admin or user_email anymore, the DB trigger handles it
        const { data, error } = await supabase
            .from('messages')
            .insert([{
                content,
                // user_id is also handled by DB auth.uid(), but strictly passing it is fine if matches
                // For safety rely on RLS/Auth mainly, but inserting it is standard.
                // Triggers will override sensitive fields.
            }])
            .select()
            .single();

        if (error) {
            console.error("Error sending message:", error);
            // Revert optimistic update
            setMessages(prev => prev.filter(m => m.id !== tempId));
            throw error;
        } else if (data) {
            // Replace optimistic message with real one
            setMessages(prev => prev.map(m => m.id === tempId ? (data as ChatMessage) : m));
        }
    };

    useEffect(() => {
        fetchMessages(false);

        const channel = supabase
            .channel('public:messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                (payload: any) => {
                    const newMessage = payload.new as ChatMessage;
                    setMessages(current => {
                        // Avoid duplicate if optimistic update already added it (check by ID)
                        // Uses a simple check, but if ID is UUID vs temp-ID it won't match.
                        // We rely on the "Replace optimistic" logic above for our own messages.
                        // But for *incoming* messages from others, we just add them.
                        // For our own messages, the Realtime event might arrive before or after the REST response.
                        // To allow the REST response to handle replacement, we might filter out our own realtime events 
                        // IF we already have them? 
                        // Simpler: Just add it if not exists.
                        if (current.some(m => m.id === newMessage.id)) return current;
                        return [...current, newMessage];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, fetchMessages]);

    return {
        messages,
        sendMessage,
        isLoading,
        hasMore,
        loadMore: () => fetchMessages(true)
    };
}

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { luxorRealtimeClient } from '@/lib/api/websocket';
import { ChatMessage } from './chat-types';

const PAGE_SIZE = 50;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function useChatMessages(conversationId: string | null) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const supabase = useMemo(() => createClient(), []);

    // Keep track of the earliest loaded message time for pagination
    const oldestMessageTimeRef = useRef<string | null>(null);

    const fetchMessages = useCallback(async (loadMore = false) => {
        if (!conversationId) return;
        if (!loadMore) setIsLoading(true);

        try {
            // TODO: Migrate to FastAPI
            if (loadMore) {
                setHasMore(false);
            } else {
                setMessages([]);
            }
        } catch (err) {
            console.error("Exception fetching messages:", err);
        } finally {
            setIsLoading(false);
        }
    }, [conversationId]);


    const uploadMedia = async (file: File): Promise<string> => {
        // TODO: Migrate to FastAPI
        throw new Error('Upload no disponible en esta versión.');
    };

    const sendMessage = async (content: string, user: any, mediaUrl?: string, messageType: 'text' | 'image' = 'text') => {
        if (!conversationId) return;
        // TODO: Migrate to FastAPI
    };

    const retryMessage = async (failedId: string, user: any) => {
        // TODO: Migrate to FastAPI
    };

    const editMessage = async (id: string, newContent: string) => {
        // TODO: Migrate to FastAPI
    };

    const deleteMessage = async (id: string) => {
        // TODO: Migrate to FastAPI
    };

    // Realtime subscription for current conversation
    useEffect(() => {
        let isMounted = true;
        
        // Reset state when switching conversations
        setMessages([]);
        setHasMore(true);
        oldestMessageTimeRef.current = null;

        if (conversationId) {
            fetchMessages(false);

            const handleMessagesUpdate = (payload: any) => {
                if (!isMounted) return;
                
                // payload from luxorRealtimeClient is already parsed
                const eventType = payload.type;
                const newMsg = payload.record as ChatMessage | null;
                const oldMsg = payload.old_record as ChatMessage | null;

                if (eventType === 'INSERT' && newMsg && newMsg.conversation_id === conversationId) {
                    setMessages(prev => {
                        // Clean dedup: only check for temp-id messages with matching content
                        const hasTempDuplicate = prev.some(
                            m => m.id.toString().startsWith('temp-') && m.content === newMsg.content && m.user_id === newMsg.user_id
                        );
                        if (hasTempDuplicate) {
                            // Replace the temp message with the real one
                            return prev
                                .filter(m => !(m.id.toString().startsWith('temp-') && m.content === newMsg.content && m.user_id === newMsg.user_id))
                                .concat(newMsg)
                                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                        }
                        // Skip if already present (exact ID match)
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                } else if (eventType === 'UPDATE' && newMsg && newMsg.conversation_id === conversationId) {
                    setMessages(prev => prev.map(m => m.id === newMsg.id ? newMsg : m));
                } else if (eventType === 'DELETE' && oldMsg) {
                    const deletedMsgId = oldMsg.id as string;
                    setMessages(prev => prev.filter(m => m.id !== deletedMsgId));
                }
            };

            const unsubMessages = luxorRealtimeClient.subscribe('messages', handleMessagesUpdate);

            return () => {
                isMounted = false;
                unsubMessages();
            };
        }

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase, conversationId]);

    return {
        messages,
        sendMessage,
        retryMessage,
        isLoading,
        hasMore,
        loadMore: () => fetchMessages(true),
        uploadMedia,
        editMessage,
        deleteMessage
    };
}

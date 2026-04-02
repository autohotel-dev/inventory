"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatMessage } from './chat-types';

const PAGE_SIZE = 50;

export function useChatMessages(conversationId: string | null) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const supabase = createClient();

    // Keep track of the earliest loaded message time for pagination
    const oldestMessageTimeRef = useRef<string | null>(null);

    const fetchMessages = useCallback(async (loadMore = false) => {
        if (!conversationId) return;
        // Optimization: Instead of using hasMore state directly, we just trust the component doesn't call this if not needed, 
        // to avoid dependency loops. Also, if we are currently loading, bail out.
        if (!loadMore) setIsLoading(true);

        let query = supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
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
    }, [supabase, conversationId]);


    const uploadMedia = async (file: File): Promise<string> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `chat/${fileName}`;

        const { data, error } = await supabase.storage
            .from('chat-media')
            .upload(filePath, file);

        if (error) {
            console.error("Error uploading media:", error);
            throw error;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('chat-media')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const sendMessage = async (content: string, user: any, mediaUrl?: string, messageType: 'text' | 'image' = 'text') => {
        if (!conversationId) return;

        // Optimistic Update
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: ChatMessage = {
            id: tempId,
            conversation_id: conversationId,
            content,
            user_id: user.id,
            user_email: user.email,
            is_admin: false, 
            is_read: false,
            created_at: new Date().toISOString(),
            media_url: mediaUrl,
            message_type: messageType,
            is_edited: false,
            deleted_at: null
        };

        setMessages(prev => [...prev, optimisticMessage]);

        const { data, error } = await supabase
            .from('messages')
            .insert([{
                conversation_id: conversationId,
                content,
                media_url: mediaUrl,
                message_type: messageType
            }])
            .select()
            .single();

        if (error) {
            console.error("Error sending message:", error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            throw error;
        } else if (data) {
            setMessages(prev => prev.map(m => m.id === tempId ? (data as ChatMessage) : m));
        }
    };

    const editMessage = async (id: string, newContent: string) => {
        if (!newContent.trim()) return;

        // Optimistic Update
        setMessages(prev => prev.map(m => m.id === id ? { ...m, content: newContent, is_edited: true } : m));

        const { error } = await supabase
            .from('messages')
            .update({ content: newContent, is_edited: true })
            .eq('id', id);

        if (error) {
            console.error("Error editing message:", error);
            throw error;
        }
    };

    const deleteMessage = async (id: string) => {
        // Optimistic Update (Soft Delete)
        setMessages(prev => prev.map(m => m.id === id ? { ...m, deleted_at: new Date().toISOString() } : m));

        const { error } = await supabase
            .from('messages')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error("Error deleting message:", error);
            throw error;
        }
    };

    // Effect handles subscription to Realtime changes for the CURRENT active conversation
    useEffect(() => {
        let isMounted = true;
        let channel: ReturnType<typeof supabase.channel> | null = null;
        
        // Reset state when switching conversations
        setMessages([]);
        setHasMore(true);
        oldestMessageTimeRef.current = null;

        if (conversationId) {
            fetchMessages(false);

            channel = supabase
                .channel(`chat_messages_${conversationId}`)
                .on(
                    'postgres_changes',
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'messages',
                        filter: `conversation_id=eq.${conversationId}`
                    },
                    (payload: any) => {
                        if (!isMounted) return;
                        
                        // Handle insert, update, delete
                        if (payload.eventType === 'INSERT') {
                            const newMsg = payload.new as ChatMessage;
                            setMessages(prev => {
                                // Evitar duplicados (por el update optimista)
                                if (prev.some(m => m.id === newMsg.id || (m.content === newMsg.content && m.user_id === newMsg.user_id && new Date(newMsg.created_at).getTime() - new Date(m.created_at).getTime() < 5000))) {
                                    // Remove the local temp message if it exists
                                    const filtered = prev.filter(m => !m.id.toString().startsWith('temp-') || m.content !== newMsg.content);
                                    return [...filtered, newMsg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                }
                                return [...prev, newMsg];
                            });
                        } else if (payload.eventType === 'UPDATE') {
                            const updatedMsg = payload.new as ChatMessage;
                            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
                        } else if (payload.eventType === 'DELETE') {
                            // Supabase soft-deletes won't trigger this, but hard deletes will.
                            const deletedMsgId = payload.old.id as string;
                            setMessages(prev => prev.filter(m => m.id !== deletedMsgId));
                        }
                    }
                )
                .subscribe();
        }

        return () => {
            isMounted = false;
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase, conversationId]);

    return {
        messages,
        sendMessage,
        isLoading,
        hasMore,
        loadMore: () => fetchMessages(true),
        uploadMedia,
        editMessage,
        deleteMessage
    };
}

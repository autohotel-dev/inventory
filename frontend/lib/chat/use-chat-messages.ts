"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatMessage } from './chat-types';

const PAGE_SIZE = 20;
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
            let query = supabase
                .from('messages')
                .select('*, reply_to:reply_to_id(id, content, user_email, message_type)')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .limit(PAGE_SIZE);

            if (loadMore && oldestMessageTimeRef.current) {
                query = query.lt('created_at', oldestMessageTimeRef.current);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching messages:", error);
                return;
            }

            if (data) {
                const newMessages = [...data].reverse() as ChatMessage[];

                if (newMessages.length > 0) {
                    oldestMessageTimeRef.current = newMessages[0].created_at;
                }

                if (data.length < PAGE_SIZE) {
                    setHasMore(false);
                }

                setMessages(prev => loadMore ? [...newMessages, ...prev] : newMessages);
            }
        } catch (err) {
            console.error("Exception fetching messages:", err);
        } finally {
            setIsLoading(false);
        }
    }, [supabase, conversationId]);


    const uploadMedia = async (file: File): Promise<string> => {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`El archivo excede el límite de 5MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            throw new Error('Solo se permiten archivos de imagen');
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `chat/${fileName}`;

        const { error } = await supabase.storage
            .from('chat-media')
            .upload(filePath, file);

        if (error) {
            throw new Error('Error al subir la imagen. Intenta de nuevo.');
        }

        const { data: { publicUrl } } = supabase.storage
            .from('chat-media')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const sendMessage = async (content: string, user: any, mediaUrl?: string, messageType: 'text' | 'image' = 'text', replyToId?: string | null, replyToData?: ChatMessage['reply_to']) => {
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
            deleted_at: null,
            reply_to_id: replyToId || null,
            reply_to: replyToData || null,
        };

        setMessages(prev => [...prev, optimisticMessage]);

        const insertPayload: any = {
            conversation_id: conversationId,
            content,
            media_url: mediaUrl,
            message_type: messageType,
        };
        if (replyToId) insertPayload.reply_to_id = replyToId;

        const { data, error } = await supabase
            .from('messages')
            .insert([insertPayload])
            .select('*, reply_to:reply_to_id(id, content, user_email, message_type)')
            .single();

        if (error) {
            setMessages(prev => prev.map(m => 
                m.id === tempId 
                    ? { ...m, id: `failed-${tempId}` } 
                    : m
            ));
            throw error;
        } else if (data) {
            setMessages(prev => prev.map(m => m.id === tempId ? (data as ChatMessage) : m));
        }
    };

    const retryMessage = async (failedId: string, user: any) => {
        const failedMsg = messages.find(m => m.id === failedId);
        if (!failedMsg) return;

        // Remove the failed message
        setMessages(prev => prev.filter(m => m.id !== failedId));

        // Re-send
        await sendMessage(failedMsg.content, user, failedMsg.media_url, failedMsg.message_type);
    };

    const editMessage = async (id: string, newContent: string) => {
        if (!newContent.trim()) return;

        // Save original for rollback
        const originalMsg = messages.find(m => m.id === id);
        
        // Optimistic Update
        setMessages(prev => prev.map(m => m.id === id ? { ...m, content: newContent, is_edited: true } : m));

        const { error } = await supabase
            .from('messages')
            .update({ content: newContent, is_edited: true })
            .eq('id', id);

        if (error) {
            // Rollback optimistic update
            if (originalMsg) {
                setMessages(prev => prev.map(m => m.id === id ? originalMsg : m));
            }
            throw error;
        }
    };

    const deleteMessage = async (id: string) => {
        // Save original for rollback
        const originalMsg = messages.find(m => m.id === id);

        // Optimistic Update (Soft Delete)
        setMessages(prev => prev.map(m => m.id === id ? { ...m, deleted_at: new Date().toISOString() } : m));

        const { error } = await supabase
            .from('messages')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            // Rollback
            if (originalMsg) {
                setMessages(prev => prev.map(m => m.id === id ? originalMsg : m));
            }
            throw error;
        }
    };

    // Realtime subscription for current conversation
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
                        
                        if (payload.eventType === 'INSERT') {
                            const newMsg = payload.new as ChatMessage;
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
                        } else if (payload.eventType === 'UPDATE') {
                            const updatedMsg = payload.new as ChatMessage;
                            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
                        } else if (payload.eventType === 'DELETE') {
                            const deletedMsgId = payload.old.id as string;
                            setMessages(prev => prev.filter(m => m.id !== deletedMsgId));
                        }
                    }
                )
                .subscribe((status: string, err: any) => {
                    if (err) {
                        console.error("Realtime subscription error:", err);
                    }
                });
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
        retryMessage,
        isLoading,
        hasMore,
        loadMore: () => fetchMessages(true),
        uploadMedia,
        editMessage,
        deleteMessage
    };
}

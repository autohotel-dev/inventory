"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatMessage, MessageReaction } from './chat-types';

const PAGE_SIZE = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for files/audio

const ALLOWED_FILE_TYPES: Record<string, string[]> = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    file: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
           'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
           'text/plain', 'text/csv'],
    audio: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg'],
};

function getMessageType(file: File): 'image' | 'file' | 'audio' {
    if (ALLOWED_FILE_TYPES.image.includes(file.type)) return 'image';
    if (ALLOWED_FILE_TYPES.audio.includes(file.type)) return 'audio';
    return 'file';
}

export function useChatMessages(conversationId: string | null) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const supabase = useMemo(() => createClient(), []);

    // Keep track of the earliest loaded message time for pagination
    const oldestMessageTimeRef = useRef<string | null>(null);

    const fetchReactions = useCallback(async (messageIds: string[]): Promise<Map<string, MessageReaction[]>> => {
        const map = new Map<string, MessageReaction[]>();
        if (messageIds.length === 0) return map;

        const { data } = await supabase
            .from('message_reactions')
            .select('*')
            .in('message_id', messageIds);

        if (data) {
            data.forEach((r: MessageReaction) => {
                const existing = map.get(r.message_id) || [];
                existing.push(r);
                map.set(r.message_id, existing);
            });
        }
        return map;
    }, [supabase]);

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

                // Fetch reactions for these messages
                const reactionMap = await fetchReactions(newMessages.map(m => m.id));
                const enriched = newMessages.map(m => ({
                    ...m,
                    reactions: reactionMap.get(m.id) || [],
                }));

                setMessages(prev => loadMore ? [...enriched, ...prev] : enriched);
            }
        } catch (err) {
            console.error("Exception fetching messages:", err);
        } finally {
            setIsLoading(false);
        }
    }, [supabase, conversationId, fetchReactions]);


    const uploadMedia = async (file: File): Promise<string> => {
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`El archivo excede el límite de 10MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        }

        const allAllowed = [...ALLOWED_FILE_TYPES.image, ...ALLOWED_FILE_TYPES.file, ...ALLOWED_FILE_TYPES.audio];
        if (!allAllowed.includes(file.type)) {
            throw new Error('Tipo de archivo no soportado. Usa imágenes, PDFs, documentos o audio.');
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `chat/${fileName}`;

        const { error } = await supabase.storage
            .from('chat-media')
            .upload(filePath, file);

        if (error) {
            throw new Error('Error al subir el archivo. Intenta de nuevo.');
        }

        const { data: { publicUrl } } = supabase.storage
            .from('chat-media')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const sendMessage = async (content: string, user: any, mediaUrl?: string, messageType: 'text' | 'image' | 'audio' | 'file' = 'text', replyToId?: string | null, replyToData?: ChatMessage['reply_to']) => {
        if (!conversationId) return;

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
            reactions: [],
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
            setMessages(prev => prev.map(m => m.id === tempId ? { ...data, reactions: [] } as ChatMessage : m));
        }
    };

    const retryMessage = async (failedId: string, user: any) => {
        const failedMsg = messages.find(m => m.id === failedId);
        if (!failedMsg) return;

        setMessages(prev => prev.filter(m => m.id !== failedId));
        await sendMessage(failedMsg.content, user, failedMsg.media_url, failedMsg.message_type);
    };

    const editMessage = async (id: string, newContent: string) => {
        if (!newContent.trim()) return;

        const originalMsg = messages.find(m => m.id === id);
        setMessages(prev => prev.map(m => m.id === id ? { ...m, content: newContent, is_edited: true } : m));

        const { error } = await supabase
            .from('messages')
            .update({ content: newContent, is_edited: true })
            .eq('id', id);

        if (error) {
            if (originalMsg) {
                setMessages(prev => prev.map(m => m.id === id ? originalMsg : m));
            }
            throw error;
        }
    };

    const deleteMessage = async (id: string) => {
        const originalMsg = messages.find(m => m.id === id);
        setMessages(prev => prev.map(m => m.id === id ? { ...m, deleted_at: new Date().toISOString() } : m));

        const { error } = await supabase
            .from('messages')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            if (originalMsg) {
                setMessages(prev => prev.map(m => m.id === id ? originalMsg : m));
            }
            throw error;
        }
    };

    // Toggle emoji reaction
    const toggleReaction = async (messageId: string, emoji: string, user: any) => {
        const msg = messages.find(m => m.id === messageId);
        if (!msg) return;

        const existingReaction = msg.reactions?.find(r => r.emoji === emoji && r.user_id === user.id);

        if (existingReaction) {
            // Remove reaction (optimistic)
            setMessages(prev => prev.map(m => 
                m.id === messageId 
                    ? { ...m, reactions: (m.reactions || []).filter(r => r.id !== existingReaction.id) } 
                    : m
            ));
            await supabase.from('message_reactions').delete().eq('id', existingReaction.id);
        } else {
            // Add reaction (optimistic)
            const tempReaction: MessageReaction = {
                id: `temp-${Date.now()}`,
                message_id: messageId,
                user_id: user.id,
                user_email: user.email,
                emoji,
                created_at: new Date().toISOString(),
            };
            setMessages(prev => prev.map(m => 
                m.id === messageId 
                    ? { ...m, reactions: [...(m.reactions || []), tempReaction] } 
                    : m
            ));
            const { data } = await supabase
                .from('message_reactions')
                .insert({ message_id: messageId, user_id: user.id, user_email: user.email, emoji })
                .select()
                .single();
            if (data) {
                setMessages(prev => prev.map(m => 
                    m.id === messageId 
                        ? { ...m, reactions: (m.reactions || []).map(r => r.id === tempReaction.id ? data : r) } 
                        : m
                ));
            }
        }
    };

    // Toggle pin
    const togglePin = async (messageId: string, isPinned: boolean) => {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_pinned: !isPinned } : m));
        
        const { error } = await supabase
            .from('messages')
            .update({ is_pinned: !isPinned })
            .eq('id', messageId);

        if (error) {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_pinned: isPinned } : m));
        }
    };

    // Search messages
    const searchMessages = async (query: string): Promise<ChatMessage[]> => {
        if (!conversationId || !query.trim()) return [];

        const { data, error } = await supabase
            .from('messages')
            .select('*, reply_to:reply_to_id(id, content, user_email, message_type)')
            .eq('conversation_id', conversationId)
            .is('deleted_at', null)
            .ilike('content', `%${query}%`)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Search error:', error);
            return [];
        }
        return (data || []) as ChatMessage[];
    };

    // Realtime subscription
    useEffect(() => {
        let isMounted = true;
        let channel: ReturnType<typeof supabase.channel> | null = null;
        
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
                            const newMsg = { ...payload.new, reactions: [] } as ChatMessage;
                            setMessages(prev => {
                                const hasTempDuplicate = prev.some(
                                    m => m.id.toString().startsWith('temp-') && m.content === newMsg.content && m.user_id === newMsg.user_id
                                );
                                if (hasTempDuplicate) {
                                    return prev
                                        .filter(m => !(m.id.toString().startsWith('temp-') && m.content === newMsg.content && m.user_id === newMsg.user_id))
                                        .concat(newMsg)
                                        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                }
                                if (prev.some(m => m.id === newMsg.id)) return prev;
                                return [...prev, newMsg];
                            });
                        } else if (payload.eventType === 'UPDATE') {
                            const updatedMsg = payload.new as ChatMessage;
                            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...updatedMsg, reactions: m.reactions || [] } : m));
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
        deleteMessage,
        toggleReaction,
        togglePin,
        searchMessages,
    };
}

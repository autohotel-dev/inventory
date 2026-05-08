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
    unread_count: number;
}

export function useConversations(currentUser: any) {
    const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = useMemo(() => createClient(), []);

    const fetchConversations = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);

        try {
            // Fetch conversations with participants
            const { data, error } = await supabase
                .from('conversations')
                .select(`
                    *,
                    participants:conversation_participants(user_id)
                `)
                .order('updated_at', { ascending: false });

            if (error || !data) {
                setIsLoading(false);
                return;
            }

            // Collect all participant user_ids that are NOT the current user (for name resolution)
            const otherUserIds = new Set<string>();
            data.forEach((conv: any) => {
                conv.participants?.forEach((p: any) => {
                    if (p.user_id !== currentUser.id) {
                        otherUserIds.add(p.user_id);
                    }
                });
            });

            // Batch resolve user names from employees table
            let userNameMap = new Map<string, string>();
            if (otherUserIds.size > 0) {
                const { data: employees } = await supabase
                    .from('employees')
                    .select('auth_user_id, first_name, last_name')
                    .in('auth_user_id', Array.from(otherUserIds));

                if (employees) {
                    employees.forEach((emp: any) => {
                        const name = [emp.first_name, emp.last_name].filter(Boolean).join(' ');
                        if (name.trim()) {
                            userNameMap.set(emp.auth_user_id, name);
                        }
                    });
                }
            }

            // Fetch last message for each conversation (batch)
            const convIds = data.map((c: any) => c.id);
            let lastMessageMap = new Map<string, any>();
            
            if (convIds.length > 0) {
                // Get the most recent message per conversation
                // We fetch the latest messages and deduplicate by conversation
                const { data: recentMessages } = await supabase
                    .from('messages')
                    .select('conversation_id, content, created_at, user_email, message_type')
                    .in('conversation_id', convIds)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                    .limit(convIds.length * 2); // Fetch enough to cover all convs

                if (recentMessages) {
                    // Keep only the first (most recent) per conversation
                    recentMessages.forEach((msg: any) => {
                        if (!lastMessageMap.has(msg.conversation_id)) {
                            lastMessageMap.set(msg.conversation_id, msg);
                        }
                    });
                }
            }

            // Fetch unread message counts per conversation
            let unreadMap = new Map<string, number>();
            if (convIds.length > 0) {
                const { data: unreadMessages } = await supabase
                    .from('messages')
                    .select('conversation_id')
                    .in('conversation_id', convIds)
                    .eq('is_read', false)
                    .neq('user_id', currentUser.id)
                    .is('deleted_at', null);

                if (unreadMessages) {
                    unreadMessages.forEach((msg: any) => {
                        unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) || 0) + 1);
                    });
                }
            }

            // Enrich conversations
            const enriched: EnrichedConversation[] = data.map((conv: any) => {
                const otherParticipant = conv.participants?.find((p: any) => p.user_id !== currentUser.id);
                const otherUserId = otherParticipant?.user_id;
                const otherUserName = otherUserId ? userNameMap.get(otherUserId) : undefined;

                return {
                    ...conv,
                    last_message: lastMessageMap.get(conv.id) || undefined,
                    other_user_name: otherUserName,
                    other_user_id: otherUserId,
                    unread_count: unreadMap.get(conv.id) || 0,
                };
            });

            // Sort by last message time (most recent first), falling back to updated_at
            enriched.sort((a, b) => {
                const aTime = a.last_message?.created_at || a.updated_at;
                const bTime = b.last_message?.created_at || b.updated_at;
                return new Date(bTime).getTime() - new Date(aTime).getTime();
            });

            setConversations(enriched);
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
            const { data: existingParticipantRows } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', currentUser.id);

            if (existingParticipantRows && existingParticipantRows.length > 0) {
                const convIds = existingParticipantRows.map((r: any) => r.conversation_id);
                const { data: directConvs } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('type', 'direct')
                    .in('id', convIds);

                if (directConvs && directConvs.length > 0) {
                    const directConvIds = directConvs.map((c: any) => c.id);
                    const { data: otherParticipant } = await supabase
                        .from('conversation_participants')
                        .select('conversation_id')
                        .eq('user_id', otherUserId)
                        .in('conversation_id', directConvIds);

                    if (otherParticipant && otherParticipant.length > 0) {
                        return otherParticipant[0].conversation_id;
                    }
                }
            }

            const { data: newConvId, error: rpcError } = await supabase.rpc('create_direct_message', {
                user1_id: currentUser.id,
                user2_id: otherUserId
            });

            if (rpcError || !newConvId) {
                return null;
            }

            fetchConversations();
            return newConvId;
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

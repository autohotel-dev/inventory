"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Conversation } from './chat-types';

export function useConversations(currentUser: any) {
    const [conversations, setConversations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();

    const fetchConversations = useCallback(async () => {
        if (!currentUser) return;
        setIsLoading(true);

        // Fetch user's conversations and the global conversation
        // RLS Policies automatically filter out conversations the user isn't part of
        const { data, error } = await supabase
            .from('conversations')
            .select(`
                *,
                participants:conversation_participants(user_id)
            `)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error("Error fetching conversations:", error);
        } else if (data) {
            // Further refinement can happen here to get usernames/latest messages
            setConversations(data);
        }
        setIsLoading(false);
    }, [currentUser, supabase]);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    const startDirectConversation = async (otherUserId: string) => {
        if (!currentUser) return null;
        console.log("Starting DM with:", otherUserId, "from:", currentUser.id);

        // 1. Check if conversation already exists
        const { data: existingParticipantRows, error: checkError } = await supabase
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
                 const { data: otherParticipant, error: otherParticipantErr } = await supabase
                    .from('conversation_participants')
                    .select('conversation_id')
                    .eq('user_id', otherUserId)
                    .in('conversation_id', directConvIds);

                if (otherParticipantErr) console.error("Error finding other participant:", otherParticipantErr);

                if (otherParticipant && otherParticipant.length > 0) {
                    console.log("Found existing DM conversation:", otherParticipant[0].conversation_id);
                    return otherParticipant[0].conversation_id; // Un chat Dm existente encontrado
                }
            }
        }

        console.log("No existing DM found. Creating new conversation...");

        // 2. No se encontró, crear uno nuevo
        // Usar RPC para saltar el problema de RLS de "No puedo leer una conversacion donde aun no soy participante"
        const { data: newConvId, error: rpcError } = await supabase.rpc('create_direct_message', {
            user1_id: currentUser.id,
            user2_id: otherUserId
        });

        if (rpcError || !newConvId) {
            console.error("Error creating conversation via RPC:", rpcError);
            return null;
        }

        console.log("Created direct message via RPC:", newConvId);

        fetchConversations();
        return newConvId;
    };

    return {
        conversations,
        isLoading,
        startDirectConversation,
        refresh: fetchConversations
    };
}

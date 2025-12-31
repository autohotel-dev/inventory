"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatMessage, ChatContextType } from '@/lib/chat/chat-types';
import { useSoundFeedback } from '@/hooks/use-sound-feedback';
import { useToast } from '@/hooks/use-toast';

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const { playClick, playSuccess: playNotificationSound } = useSoundFeedback();
    const { success, error: showError, info } = useToast();
    const supabase = createClient();
    const userRef = useRef<any>(null);

    // Initial fetch and subscription
    useEffect(() => {
        const fetchMessages = async () => {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            userRef.current = user;

            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: true })
                .limit(50);

            if (!error && data) {
                setMessages(data as ChatMessage[]);
            }
            setIsLoading(false);
        };

        fetchMessages();

        // Realtime Subscription
        const channel = supabase
            .channel('public:messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                (payload) => {
                    const newMessage = payload.new as ChatMessage;
                    setMessages((current) => [...current, newMessage]);

                    // If chat is closed and message is not mine, increment unread and play sound
                    if (!isOpen && newMessage.user_id !== userRef.current?.id) {
                        setUnreadCount(prev => prev + 1);
                        playNotificationSound(); // Ding!
                        info("Nuevo mensaje de soporte", "Alguien ha escrito en el chat global.");
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isOpen, playNotificationSound, info, supabase]);

    // Reset unread count when opening
    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
        }
    }, [isOpen]);

    const sendMessage = async (content: string) => {
        if (!content.trim()) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if user is admin (simple check by email or metadata if available, 
        // for now we'll assume the 'hackm' user or specific email is admin, 
        // OR we just pass a flag if we had it in the session)
        // For this MVP, we'll check if email contains 'admin' or matches specific logic.
        // Actually, let's just use the metadata or default to false.
        const isAdmin = user.email?.includes('admin') || user.email === 'hackm@hotmail.com'; // Adjust as needed

        const newMessage = {
            content,
            user_id: user.id,
            user_email: user.email,
            is_admin: isAdmin,
        };

        // Click sound for feedback
        playClick();

        // Optimistic update (optional, but Realtime is fast enough usually)
        // But we rely on Realtime to add it to the list to ensure consistency

        const { error } = await supabase
            .from('messages')
            .insert([newMessage]);

        if (error) {
            console.error("Error sending message:", error);
            showError("Error", "No se pudo enviar el mensaje.");
        }
    };

    const value = {
        messages,
        sendMessage,
        isLoading,
        isOpen,
        setIsOpen,
        unreadCount
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}

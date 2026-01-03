"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatContextType } from '@/lib/chat/chat-types';
import { useChatMessages } from '@/lib/chat/use-chat-messages';
import { useChatNotifications } from '@/lib/chat/use-chat-notifications';
import { useChatPresence } from '@/lib/chat/use-chat-presence';
import { RealtimeChannel } from '@supabase/supabase-js';

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [channel, setChannel] = useState<RealtimeChannel | null>(null);

    const supabase = createClient();

    // Get current user on mount and setup channel
    useEffect(() => {
        let activeChannel: RealtimeChannel | null = null;

        const init = async () => {
            const { data } = await supabase.auth.getUser();
            if (data.user) {
                setCurrentUser(data.user);

                // Initialize channel for both Messages and Presence
                activeChannel = supabase.channel('public:messages');
                setChannel(activeChannel);

                // Subscription is handled in useChatMessages, but we need the channel instance for Presence
                // Actually, useChatMessages creates its own subscription.
                // It might be better to share one channel or have separate ones?
                // 'public:messages' channel can handle both Postgres Changes and Presence.
                // Let's pass this channel to the hooks if possible, otherwise they might create duplicates.
                // For now, useChatPresence needs the channel object to track(). 
                // useChatMessages uses .on(...).subscribe(). 

                // To avoid multiple subscriptions to the same channel name, we should move the subscription logic here 
                // or ensure we only subscribe once.
                // The current useChatMessages subscribes internally. 
                // Let's modify useChatMessages to accept an optional channel or just let it be independent (Postgres changes)
                // while Presence uses this channel. Supabase handles multiplexing usually.
                activeChannel.subscribe();
            }
        };

        init();

        return () => {
            if (activeChannel) supabase.removeChannel(activeChannel);
        };
    }, [supabase]);

    const { messages, sendMessage: sendMsgFn, isLoading, hasMore, loadMore } = useChatMessages();
    // Note: useChatMessages currently creates its own subscription. This is fine for now but optimization for later.

    const { notifyNewMessage } = useChatNotifications(currentUser?.id, isOpen);
    const { onlineUsers, typingUsers, handleTypingInput } = useChatPresence(channel, currentUser);

    // Monitor for new messages to update unread count and notify
    const lastMessageIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];

            if (lastMessageIdRef.current && lastMsg.id !== lastMessageIdRef.current) {
                if ((!isOpen || (typeof document !== 'undefined' && document.hidden)) && lastMsg.user_id !== currentUser?.id) {
                    setUnreadCount(prev => prev + 1);
                    notifyNewMessage(lastMsg);
                }
            }
            lastMessageIdRef.current = lastMsg.id;
        }
    }, [messages, isOpen, currentUser, notifyNewMessage]);

    // Reset unread count when opening
    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
        }
    }, [isOpen]);

    const sendMessage = async (content: string) => {
        if (!currentUser) return;
        await sendMsgFn(content, currentUser);
    };

    const value = {
        messages,
        sendMessage,
        isLoading,
        isOpen,
        setIsOpen,
        unreadCount,
        hasMore,
        loadMore,
        onlineUsers,
        typingUsers,
        handleTypingInput
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

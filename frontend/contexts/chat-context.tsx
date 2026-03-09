"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatContextType } from '@/lib/chat/chat-types';
import { useChatMessages } from '@/lib/chat/use-chat-messages';
import { useChatNotifications } from '@/lib/chat/use-chat-notifications';
import { useChatPresence } from '@/lib/chat/use-chat-presence';
import { useSoundEngine } from '@/hooks/use-sound-notifications';
import { RealtimeChannel } from '@supabase/supabase-js';

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const { playNewMessage } = useSoundEngine();

    const supabase = createClient();

    // Get current user on mount
    useEffect(() => {
        const init = async () => {
            const { data } = await supabase.auth.getUser();
            if (data.user) {
                setCurrentUser(data.user);
            }
        };
        init();
    }, [supabase]);

    const { messages, sendMessage: sendMsgFn, isLoading, hasMore, loadMore, uploadMedia, editMessage, deleteMessage } = useChatMessages(activeConversationId);
    // Note: useChatMessages currently creates its own subscription. This is fine for now but optimization for later.

    const { notifyNewMessage } = useChatNotifications(currentUser?.id, isOpen);
    // Use dedicated presence hook which manages its own channel 'presence:global'
    const { onlineUsers, typingUsers, handleTypingInput } = useChatPresence(currentUser);

    // Monitor for new messages to update unread count and notify
    const lastMessageIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];

            if (lastMessageIdRef.current && lastMsg.id !== lastMessageIdRef.current) {
                if ((!isOpen || (typeof document !== 'undefined' && document.hidden)) && lastMsg.user_id !== currentUser?.id) {
                    setUnreadCount(prev => prev + 1);
                    notifyNewMessage(lastMsg);
                    playNewMessage();
                }
            }
            lastMessageIdRef.current = lastMsg.id;
        }
    }, [messages, isOpen, currentUser, notifyNewMessage]);

    // Reset unread count AND mark as read when opening
    useEffect(() => {
        if (isOpen && messages.length > 0) {
            setUnreadCount(0);
            
            // Mark all current unread messages from others as read
            const unreadIds = messages
                .filter(m => !m.is_read && m.user_id !== currentUser?.id)
                .map(m => m.id);
            
            if (unreadIds.length > 0) {
                supabase
                    .from('messages')
                    .update({ is_read: true })
                    .in('id', unreadIds)
                    .then(({ error }: { error: any }) => {
                        if (error) console.error('Error marking messages as read:', error);
                    });
            }
        }
    }, [isOpen, messages, currentUser, supabase]);

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
        handleTypingInput,
        uploadMedia,
        currentUser,
        editMessage,
        deleteMessage,
        activeConversationId,
        setActiveConversationId
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

"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatContextType, ChatMessage } from '@/lib/chat/chat-types';
import { useChatMessages } from '@/lib/chat/use-chat-messages';
import { useChatNotifications } from '@/lib/chat/use-chat-notifications';
import { useChatPresence } from '@/lib/chat/use-chat-presence';
import { useConversations } from '@/lib/chat/use-conversations';
import { useSoundEngine } from '@/hooks/use-sound-notifications';
import { useToast } from '@/hooks/use-toast';

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const { playNewMessage } = useSoundEngine();
    const { error: toastError } = useToast();

    const supabase = useMemo(() => createClient(), []);

    // Get current user on mount
    useEffect(() => {
        const init = async () => {
            const { data } = await supabase.auth.getUser();
            if (data.user) {
                setCurrentUser(data.user);
            }
        };
        init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { messages, sendMessage: sendMsgFn, retryMessage: retryMsgFn, isLoading, hasMore, loadMore, uploadMedia, editMessage, deleteMessage, toggleReaction: toggleReactionFn, togglePin: togglePinFn, searchMessages: searchMsgFn } = useChatMessages(activeConversationId);
    // Note: useChatMessages currently creates its own subscription. This is fine for now but optimization for later.

    const { notifyNewMessage } = useChatNotifications(currentUser?.id, isOpen);
    // Use dedicated presence hook which manages its own channel 'presence:global'
    const { onlineUsers, typingUsers, handleTypingInput } = useChatPresence(currentUser);

    const { conversations: convList, isLoading: isConvLoading, startDirectConversation, refresh: refreshConversations } = useConversations(currentUser);

    // Initialize global unread count from DB on mount
    useEffect(() => {
        if (!currentUser) return;
        const fetchInitialUnread = async () => {
            const { count, error } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('is_read', false)
                .neq('user_id', currentUser.id);
            
            if (!error && count && count > 0) {
                setUnreadCount(count);
            }
        };
        fetchInitialUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id]);

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

    // Reset unread count AND mark as read when opening a conversation
    useEffect(() => {
        if (isOpen && activeConversationId && messages.length > 0) {
            setUnreadCount(prev => {
                const unreadInConv = messages.filter(m => !m.is_read && m.user_id !== currentUser?.id).length;
                return Math.max(0, prev - unreadInConv);
            });
            
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
                        else refreshConversations(); // Update per-conversation unread badges
                    });
            }
        }
    }, [isOpen, activeConversationId, messages, currentUser, supabase, refreshConversations]);

    // Flash browser tab title when there are unread messages
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const originalTitle = 'AHLM';

        if (unreadCount > 0 && !isOpen) {
            let showNotif = true;
            const interval = setInterval(() => {
                document.title = showNotif 
                    ? `💬 (${unreadCount}) Nuevo mensaje` 
                    : originalTitle;
                showNotif = !showNotif;
            }, 1500);

            return () => {
                clearInterval(interval);
                document.title = originalTitle;
            };
        } else {
            document.title = originalTitle;
        }
    }, [unreadCount, isOpen]);

    const retryMessage = async (failedId: string) => {
        if (!currentUser) return;
        try {
            await retryMsgFn(failedId, currentUser);
        } catch {
            toastError('Error', 'No se pudo reenviar el mensaje.');
        }
    };

    const sendMessage = async (content: string, mediaUrl?: string, messageType: 'text' | 'image' | 'audio' | 'file' = 'text') => {
        if (!currentUser) return;
        try {
            const replyData = replyTo ? {
                id: replyTo.id,
                content: replyTo.content,
                user_email: replyTo.user_email,
                message_type: replyTo.message_type,
            } : undefined;
            await sendMsgFn(content, currentUser, mediaUrl, messageType, replyTo?.id, replyData);
            setReplyTo(null);
        } catch {
            toastError('Error', 'No se pudo enviar el mensaje. Intenta de nuevo.');
        }
    };

    const toggleReaction = async (messageId: string, emoji: string) => {
        if (!currentUser) return;
        await toggleReactionFn(messageId, emoji, currentUser);
    };

    const togglePin = async (messageId: string, isPinned: boolean) => {
        await togglePinFn(messageId, isPinned);
    };

    const searchMessages = async (query: string) => {
        return searchMsgFn(query);
    };

    const value = {
        messages,
        sendMessage,
        retryMessage,
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
        setActiveConversationId,
        convList,
        isConvLoading,
        startDirectConversation,
        refreshConversations,
        replyTo,
        setReplyTo,
        toggleReaction,
        togglePin,
        searchMessages,
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

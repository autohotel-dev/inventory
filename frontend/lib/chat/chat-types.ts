export interface ChatMessage {
    id: string;
    conversation_id: string;
    content: string;
    user_id: string;
    user_email: string;
    created_at: string;
    is_admin: boolean;
    is_read: boolean;
    media_url?: string;
    message_type: 'text' | 'image';
    is_edited: boolean;
    deleted_at: string | null;
}

export interface Conversation {
    id: string;
    type: 'direct' | 'group' | 'global';
    created_at: string;
    updated_at: string;
}

export interface ConversationParticipant {
    conversation_id: string;
    user_id: string;
    joined_at: string;
}

export interface ChatContextType {
    messages: ChatMessage[];
    sendMessage: (content: string, mediaUrl?: string, messageType?: 'text' | 'image') => Promise<void>;
    editMessage: (id: string, newContent: string) => Promise<void>;
    deleteMessage: (id: string) => Promise<void>;
    isLoading: boolean;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    unreadCount: number;
    hasMore: boolean;
    loadMore: () => void;
    onlineUsers: { user_id: string; email: string }[];
    typingUsers: { user_id: string; email: string }[];
    handleTypingInput: () => void;
    uploadMedia: (file: File) => Promise<string>;
    currentUser: any;
    activeConversationId: string | null;
    setActiveConversationId: (id: string | null) => void;
}

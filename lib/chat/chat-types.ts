export interface ChatMessage {
    id: string;
    content: string;
    user_id: string;
    user_email?: string;
    is_admin: boolean;
    created_at: string;
}

export interface ChatContextType {
    messages: ChatMessage[];
    sendMessage: (content: string) => Promise<void>;
    isLoading: boolean;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    unreadCount: number;
    hasMore: boolean;
    loadMore: () => void;
    onlineUsers: { user_id: string; email: string }[];
    typingUsers: { user_id: string; email: string }[];
    handleTypingInput: () => void;
}

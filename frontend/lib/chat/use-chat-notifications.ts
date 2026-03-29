"use client";

import { useEffect, useCallback } from 'react';
import { useSoundFeedback } from '@/hooks/use-sound-feedback';
import { useToast } from '@/hooks/use-toast';
import { ChatMessage } from './chat-types';

export function useChatNotifications(
    currentUserId: string | null | undefined,
    isOpen: boolean
) {
    const { playSuccess: playNotificationSound } = useSoundFeedback();
    const { info } = useToast();

    // Request permissions on mount
    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    const notifyNewMessage = useCallback((newMessage: ChatMessage) => {
        // Don't notify if message is from self
        if (newMessage.user_id === currentUserId) return;

        // If chat is OPEN and focused, we might just want a subtle sound or nothing
        // If chat is CLOSED or document HIDDEN, we want distinct notification
        const isHidden = typeof document !== 'undefined' && document.hidden;
        
        if (!isOpen || isHidden) {
            playNotificationSound();

            // In-App Toast
            const senderName = newMessage.user_email?.split('@')[0] || 'Alguien';
            info("Nuevo mensaje", `${senderName}: ${newMessage.content.substring(0, 30)}...`);

            // Browser Notification
            if (Notification.permission === "granted" && isHidden) {
                try {
                    new Notification("Nuevo Mensaje - Soporte", {
                        body: newMessage.content,
                        icon: "/luxor-logo.png", // Verify this path exists or use a generic one
                        tag: "chat-message",
                        requireInteraction: false
                    });
                } catch (e) {
                    console.error("Notification error:", e);
                }
            }
        }
    }, [currentUserId, isOpen, playNotificationSound, info]);

    return { notifyNewMessage };
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface Notification {
    id: string;
    user_id: string;
    employee_id: string | null;
    type: 'stock_low' | 'stock_critical' | 'order_pending' | 'payment_due' | 'shift_started' | 'shift_ended' | 'system_alert' | 'info';
    title: string;
    message: string;
    data: any;
    action_url: string | null;
    is_read: boolean;
    is_archived: boolean;
    created_at: string;
    read_at: string | null;
}

interface UseNotificationsReturn {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    archiveNotification: (id: string) => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    refreshNotifications: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchNotifications = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setNotifications([]);
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", user.id)
                .eq("is_archived", false)
                .order("created_at", { ascending: false })
                .limit(50);

            if (error) {
                console.error("Error fetching notifications:", error);
                return;
            }

            setNotifications(data || []);
        } catch (error) {
            console.error("Error in fetchNotifications:", error);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        fetchNotifications();

        // Subscribe to real-time changes
        let channel: RealtimeChannel;

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;

            channel = supabase
                .channel('notifications_changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        console.log('Notification change received:', payload);
                        fetchNotifications(); // Refresh on any change
                    }
                )
                .subscribe();
        });

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [fetchNotifications, supabase]);

    const markAsRead = async (id: string) => {
        const { error } = await supabase
            .from("notifications")
            .update({
                is_read: true,
                read_at: new Date().toISOString()
            })
            .eq("id", id);

        if (!error) {
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
            );
        }
    };

    const markAllAsRead = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from("notifications")
            .update({
                is_read: true,
                read_at: new Date().toISOString()
            })
            .eq("user_id", user.id)
            .eq("is_read", false);

        if (!error) {
            setNotifications(prev =>
                prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
            );
        }
    };

    const archiveNotification = async (id: string) => {
        const { error } = await supabase
            .from("notifications")
            .update({ is_archived: true })
            .eq("id", id);

        if (!error) {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }
    };

    const deleteNotification = async (id: string) => {
        const { error } = await supabase
            .from("notifications")
            .delete()
            .eq("id", id);

        if (!error) {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        archiveNotification,
        deleteNotification,
        refreshNotifications: fetchNotifications
    };
}

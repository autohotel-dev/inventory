"use client";

import { useState, useEffect, useCallback } from "react";
import { luxorRealtimeClient } from "@/lib/api/websocket";
import { apiClient, fetchAuthUserDeduped } from "@/lib/api/client";

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
    const fetchNotifications = useCallback(async () => {
        try {
            const resAuth = await fetchAuthUserDeduped();
            const authData = resAuth.data;
            const user = authData?.session?.user || authData?.user || authData;

            if (!user || !user.id) {
                setNotifications([]);
                setLoading(false);
                return;
            }

            const { data } = await apiClient.get(`/system/crud/notifications?user_id=${user.id}&limit=50`);
            setNotifications(data || []);
        } catch (error) {
            console.error("Error in fetchNotifications:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();

        let unsubscribe = () => {};

        fetchAuthUserDeduped().then(resAuth => {
                const user = resAuth.data?.user || resAuth.data;
                if (!user) return;

                unsubscribe = luxorRealtimeClient.subscribe("notifications", (payload) => {
                    console.log('Notification change received:', payload);
                    // Just refresh instead of complex state management since the schema might be large
                    fetchNotifications(); 
                });
            }).catch(() => {});

        return () => {
            unsubscribe();
        };
    }, [fetchNotifications]);

    const markAsRead = async (id: string) => {
        try {
            await apiClient.patch(`/system/crud/notifications/${id}`, {
                is_read: true,
                read_at: new Date().toISOString()
            });

            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
            );
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const markAllAsRead = async () => {
        try {
            // Find unread and mark them
            const unread = notifications.filter(n => !n.is_read);
            await Promise.all(unread.map(n => 
                apiClient.patch(`/system/crud/notifications/${n.id}`, {
                    is_read: true,
                    read_at: new Date().toISOString()
                })
            ));

            setNotifications(prev =>
                prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
            );
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    };

    const archiveNotification = async (id: string) => {
        try {
            await apiClient.patch(`/system/crud/notifications/${id}`, { is_archived: true });

            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error("Error archiving notification:", error);
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            await apiClient.delete(`/system/crud/notifications/${id}`);

            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error("Error deleting notification:", error);
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

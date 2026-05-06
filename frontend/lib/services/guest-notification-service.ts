/**
 * Guest Notification Service (Backend)
 * Handles sending push notifications to guests using Web Push API
 */

import webpush from 'web-push';
import { apiClient } from '@/lib/api/client';

// VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:autohoteldev@gmail.com';

// Configure web-push
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface NotificationPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, any>;
    action_url?: string;
    notification_type: 'checkout_reminder' | 'service_promo' | 'survey' | 'welcome' | 'custom';
}

export interface GuestSubscription {
    id: string;
    room_stay_id: string;
    room_number: string;
    subscription_data: any;
    is_active: boolean;
}

/**
 * Send notification to a specific guest subscription
 */
export async function sendNotificationToGuest(
    subscriptionId: string,
    payload: NotificationPayload
): Promise<{ success: boolean; error?: string }> {
    try {
        // Get subscription from database
        const { data: subscription } = await apiClient.get(`/system/crud/guest_subscriptions/${subscriptionId}`);

        if (!subscription) {
            return { success: false, error: 'Subscription not found' };
        }

        // Fetch the room stay to get the guest access token
        let finalActionUrl = payload.action_url;
        try {
            const { data: roomStay } = await apiClient.get(`/system/crud/room_stays/${subscription.room_stay_id}`);
            if (roomStay?.guest_access_token && finalActionUrl) {
                const separator = finalActionUrl.includes('?') ? '&' : '?';
                finalActionUrl = `${finalActionUrl}${separator}token=${roomStay.guest_access_token}`;
            } else if (roomStay?.guest_access_token && !finalActionUrl) {
                finalActionUrl = `/guest-portal/${subscription.room_number}?token=${roomStay.guest_access_token}`;
            }
        } catch {
            // Room stay not found, continue without token
        }

        const pushSubscription = subscription.subscription_data;

        try {
            await webpush.sendNotification(
                pushSubscription,
                JSON.stringify({
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon || '/icons/icon-192.png',
                    badge: payload.badge || '/icons/icon-96x96.svg',
                    tag: payload.tag || 'hotel-notification',
                    data: {
                        ...payload.data,
                        action_url: finalActionUrl,
                    },
                })
            );

            // Log notification in database
            await apiClient.post('/system/crud/guest_notifications', {
                guest_subscription_id: subscriptionId,
                room_number: subscription.room_number,
                title: payload.title,
                body: payload.body,
                icon_url: payload.icon,
                action_url: finalActionUrl,
                notification_type: payload.notification_type,
                data: payload.data || {},
                delivered: true,
                sent_at: new Date().toISOString(),
            });

            // Update last_notified_at
            await apiClient.patch(`/system/crud/guest_subscriptions/${subscriptionId}`, {
                last_notified_at: new Date().toISOString()
            });

            return { success: true };
        } catch (pushError: any) {
            if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                await apiClient.patch(`/system/crud/guest_subscriptions/${subscriptionId}`, {
                    is_active: false
                });
                return { success: false, error: 'Subscription expired' };
            }
            throw pushError;
        }
    } catch (error) {
        console.error('Error sending notification:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Send notification to a specific room number
 */
export async function sendNotificationToRoom(
    roomNumber: string,
    payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
    const { data: subsData } = await apiClient.get('/system/crud/guest_subscriptions', {
        params: { room_number: roomNumber, is_active: true }
    });
    const subscriptions = Array.isArray(subsData) ? subsData : (subsData?.items || subsData?.results || []);

    if (!subscriptions || subscriptions.length === 0) {
        return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
        const result = await sendNotificationToGuest(subscription.id, payload);
        if (result.success) sent++;
        else failed++;
    }

    return { sent, failed };
}

/**
 * Send notification to all active guests
 */
export async function sendNotificationToAll(
    payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
    const { data: subsData } = await apiClient.get('/system/crud/guest_subscriptions', {
        params: { is_active: true }
    });
    const subscriptions = Array.isArray(subsData) ? subsData : (subsData?.items || subsData?.results || []);

    if (!subscriptions || subscriptions.length === 0) {
        return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
        const result = await sendNotificationToGuest(subscription.id, payload);
        if (result.success) sent++;
        else failed++;
    }

    return { sent, failed };
}

/**
 * Render notification template with variables
 */
export async function renderTemplate(
    templateId: string,
    variables: Record<string, string>
): Promise<{ title: string; body: string } | null> {
    try {
        const { data: template } = await apiClient.get(`/system/crud/notification_templates/${templateId}`);

        if (!template) return null;

        let title = template.title_template;
        let body = template.body_template;

        Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`{${key}}`, 'g');
            title = title.replace(regex, value);
            body = body.replace(regex, value);
        });

        return { title, body };
    } catch {
        return null;
    }
}

/**
 * Send checkout reminder to guests checking out soon
 */
export async function sendCheckoutReminders(hoursBeforeCheckout: number = 2): Promise<void> {
    try {
        const { data: staysData } = await apiClient.get('/system/crud/room_stays', {
            params: { status: 'ACTIVA' }
        });
        const roomStays = Array.isArray(staysData) ? staysData : (staysData?.items || staysData?.results || []);

        const now = new Date();
        const futureTime = new Date(now.getTime() + hoursBeforeCheckout * 60 * 60 * 1000);
        const maxTime = new Date(now.getTime() + (hoursBeforeCheckout + 1) * 60 * 60 * 1000);

        // Filter stays with checkout in the time window
        const relevantStays = roomStays.filter((stay: any) => {
            if (!stay.expected_check_out_at) return false;
            const checkout = new Date(stay.expected_check_out_at);
            return checkout >= futureTime && checkout < maxTime;
        });

        if (relevantStays.length === 0) return;

        // Get checkout reminder template
        let template: any = null;
        try {
            const { data: templatesData } = await apiClient.get('/system/crud/notification_templates', {
                params: { notification_type: 'checkout_reminder' }
            });
            const templates = Array.isArray(templatesData) ? templatesData : (templatesData?.items || templatesData?.results || []);
            template = templates[0];
        } catch {}

        for (const stay of relevantStays) {
            const roomNumber = stay.rooms?.number || stay.room_number;
            if (!roomNumber || !stay.expected_check_out_at) continue;

            const checkoutTime = new Date(stay.expected_check_out_at).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
            });

            let title = 'Recordatorio: Check-out próximo';
            let body = `Su check-out está programado para las ${checkoutTime}`;

            if (template) {
                const rendered = await renderTemplate(template.id, {
                    room_number: roomNumber,
                    checkout_time: checkoutTime,
                });
                if (rendered) {
                    title = rendered.title;
                    body = rendered.body;
                }
            }

            await sendNotificationToRoom(roomNumber, {
                title,
                body,
                notification_type: 'checkout_reminder',
                action_url: `/guest-portal/${roomNumber}`,
            });
        }
    } catch (error) {
        console.error('Error sending checkout reminders:', error);
    }
}

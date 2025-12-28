/**
 * Guest Notification Service (Backend)
 * Handles sending push notifications to guests using Web Push API
 */

import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';

// VAPID keys - Generated using: npx web-push generate-vapid-keys
// Store these in .env.local
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@hotel.com';

// Configure web-push
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        VAPID_SUBJECT,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
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
        const supabase = await createClient();

        // Get subscription from database
        const { data: subscription, error } = await supabase
            .from('guest_subscriptions')
            .select('*')
            .eq('id', subscriptionId)
            .eq('is_active', true)
            .single();

        if (error || !subscription) {
            return { success: false, error: 'Subscription not found' };
        }

        // Send push notification
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
                        action_url: payload.action_url,
                    },
                })
            );

            // Log notification in database
            await supabase.from('guest_notifications').insert({
                guest_subscription_id: subscriptionId,
                room_number: subscription.room_number,
                title: payload.title,
                body: payload.body,
                icon_url: payload.icon,
                action_url: payload.action_url,
                notification_type: payload.notification_type,
                data: payload.data || {},
                delivered: true,
                sent_at: new Date().toISOString(),
            });

            // Update last_notified_at
            await supabase
                .from('guest_subscriptions')
                .update({ last_notified_at: new Date().toISOString() })
                .eq('id', subscriptionId);

            return { success: true };
        } catch (pushError: any) {
            // Handle expired or invalid subscriptions
            if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                // Mark subscription as inactive
                await supabase
                    .from('guest_subscriptions')
                    .update({ is_active: false })
                    .eq('id', subscriptionId);

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
    const supabase = await createClient();

    // Get all active subscriptions for this room
    const { data: subscriptions, error } = await supabase
        .from('guest_subscriptions')
        .select('id')
        .eq('room_number', roomNumber)
        .eq('is_active', true);

    if (error || !subscriptions || subscriptions.length === 0) {
        return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
        const result = await sendNotificationToGuest(subscription.id, payload);
        if (result.success) {
            sent++;
        } else {
            failed++;
        }
    }

    return { sent, failed };
}

/**
 * Send notification to all active guests
 */
export async function sendNotificationToAll(
    payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
    const supabase = await createClient();

    // Get all active subscriptions
    const { data: subscriptions, error } = await supabase
        .from('guest_subscriptions')
        .select('id')
        .eq('is_active', true);

    if (error || !subscriptions || subscriptions.length === 0) {
        return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
        const result = await sendNotificationToGuest(subscription.id, payload);
        if (result.success) {
            sent++;
        } else {
            failed++;
        }
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
    const supabase = await createClient();

    const { data: template, error } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('id', templateId)
        .eq('is_active', true)
        .single();

    if (error || !template) {
        return null;
    }

    let title = template.title_template;
    let body = template.body_template;

    // Replace variables in templates
    Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        title = title.replace(regex, value);
        body = body.replace(regex, value);
    });

    return { title, body };
}

/**
 * Send checkout reminder to guests checking out soon
 */
export async function sendCheckoutReminders(hoursBeforeCheckout: number = 2): Promise<void> {
    const supabase = await createClient();

    // Calculate time window
    const now = new Date();
    const futureTime = new Date(now.getTime() + hoursBeforeCheckout * 60 * 60 * 1000);
    const maxTime = new Date(now.getTime() + (hoursBeforeCheckout + 1) * 60 * 60 * 1000);

    // Get room stays with checkout in the time window
    const { data: roomStays, error } = await supabase
        .from('room_stays')
        .select(`
      id,
      expected_check_out_at,
      rooms (
        number
      )
    `)
        .eq('status', 'ACTIVA')
        .gte('expected_check_out_at', futureTime.toISOString())
        .lt('expected_check_out_at', maxTime.toISOString());

    if (error || !roomStays || roomStays.length === 0) {
        return;
    }

    // Get checkout reminder template
    const { data: template } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('template_type', 'checkout_reminder')
        .eq('is_active', true)
        .single();

    for (const stay of roomStays) {
        if (!stay.rooms || !stay.expected_check_out_at) continue;

        const roomNumber = (stay.rooms as any).number;
        const checkoutTime = new Date(stay.expected_check_out_at).toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
        });

        // Render template
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

        // Send notification
        await sendNotificationToRoom(roomNumber, {
            title,
            body,
            notification_type: 'checkout_reminder',
            action_url: `/guest-portal/${roomNumber}`,
        });
    }
}

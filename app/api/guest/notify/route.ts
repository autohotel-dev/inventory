/**
 * API Route: Send Notification to Guests
 * POST /api/guest/notify
 * Sends push notifications to specified guests
 * Requires: Staff authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    sendNotificationToGuest,
    sendNotificationToRoom,
    sendNotificationToAll,
    renderTemplate,
    type NotificationPayload,
} from '@/lib/services/guest-notification-service';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify staff authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const {
            target_type, // 'guest' | 'room' | 'all'
            target_id, // subscription_id or room_number
            title,
            body: messageBody,
            template_id,
            template_variables,
            notification_type = 'custom',
            icon,
            action_url,
            data,
        } = body;

        let finalTitle = title;
        let finalBody = messageBody;

        // Render template if provided
        if (template_id && template_variables) {
            const rendered = await renderTemplate(template_id, template_variables);
            if (rendered) {
                finalTitle = rendered.title;
                finalBody = rendered.body;
            }
        }

        // Validate required fields
        if (!finalTitle || !finalBody) {
            return NextResponse.json(
                { error: 'Title and body are required' },
                { status: 400 }
            );
        }

        const payload: NotificationPayload = {
            title: finalTitle,
            body: finalBody,
            icon,
            action_url,
            data,
            notification_type,
        };

        let result;

        // Send based on target type
        switch (target_type) {
            case 'guest':
                if (!target_id) {
                    return NextResponse.json(
                        { error: 'subscription_id required for guest target' },
                        { status: 400 }
                    );
                }
                result = await sendNotificationToGuest(target_id, payload);
                break;

            case 'room':
                if (!target_id) {
                    return NextResponse.json(
                        { error: 'room_number required for room target' },
                        { status: 400 }
                    );
                }
                result = await sendNotificationToRoom(target_id, payload);
                break;

            case 'all':
                result = await sendNotificationToAll(payload);
                break;

            default:
                return NextResponse.json(
                    { error: 'Invalid target_type' },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            result,
        });
    } catch (error) {
        console.error('Error in notify API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

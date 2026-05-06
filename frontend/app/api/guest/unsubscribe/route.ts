/**
 * API Route: Unsubscribe from Push Notifications
 * POST /api/guest/unsubscribe
 * Deactivates a guest's push notification subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api/client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { subscription_id, endpoint } = body;

        if (!subscription_id && !endpoint) {
            return NextResponse.json(
                { error: 'Missing subscription_id or endpoint' },
                { status: 400 }
            );
        }

        let targetId = subscription_id;

        if (!targetId && endpoint) {
            const { data: subsData } = await apiClient.get('/system/crud/guest_subscriptions', {
                params: { is_active: true }
            });
            const subscriptions = Array.isArray(subsData) ? subsData : (subsData?.items || subsData?.results || []);
            
            const sub = subscriptions.find((s: any) => s.subscription_data?.endpoint === endpoint);
            if (sub) {
                targetId = sub.id;
            } else {
                return NextResponse.json({
                    success: true,
                    message: 'Subscription not found or already inactive',
                });
            }
        }

        if (targetId) {
            await apiClient.patch(`/system/crud/guest_subscriptions/${targetId}`, {
                is_active: false,
                updated_at: new Date().toISOString(),
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Unsubscribed successfully',
        });
    } catch (error) {
        console.error('Error in unsubscribe API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

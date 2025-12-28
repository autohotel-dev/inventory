/**
 * API Route: Unsubscribe from Push Notifications
 * POST /api/guest/unsubscribe
 * Deactivates a guest's push notification subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { subscription_id } = body;

        if (!subscription_id) {
            return NextResponse.json(
                { error: 'Missing subscription_id' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Mark subscription as inactive
        const { error } = await supabase
            .from('guest_subscriptions')
            .update({
                is_active: false,
                updated_at: new Date().toISOString(),
            })
            .eq('id', subscription_id);

        if (error) {
            throw error;
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

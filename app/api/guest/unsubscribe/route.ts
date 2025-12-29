/**
 * API Route: Unsubscribe from Push Notifications
 * POST /api/guest/unsubscribe
 * Deactivates a guest's push notification subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

        // Use Service Role Key to bypass RLS
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

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

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
        const { subscription_id, endpoint } = body;

        if (!subscription_id && !endpoint) {
            return NextResponse.json(
                { error: 'Missing subscription_id or endpoint' },
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

        let query = supabase
            .from('guest_subscriptions')
            .update({
                is_active: false,
                updated_at: new Date().toISOString(),
            });

        if (subscription_id) {
            query = query;
        } else if (endpoint) {
            // Find by endpoint in the JSONB column
            // subscription_data ->> 'endpoint'
            // We need to find the record first because filtering JSONB in update is tricky or we use a filter
            // Ideally we filter by subscription_data->>'endpoint'
            // But supabase-js update() works on columns.
            // We should select id first.

            const { data: sub } = await supabase
                .from('guest_subscriptions')
                .select('id')
                
                .filter('subscription_data->>endpoint', 'eq', endpoint)
                ;

            if (sub) {
                query = query;
            } else {
                return NextResponse.json({
                    success: true,
                    message: 'Subscription not found or already inactive',
                });
            }
        }

        const { error } = await query;

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

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { room_stay_id, room_number, subscription_data, user_agent } = body;

        // Validate required fields
        if (!room_stay_id || !room_number || !subscription_data) {
            return NextResponse.json(
                { error: 'Missing required fields' },
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

        // Verify the room stay exists and is active
        const { data: roomStay, error: roomStayError } = await supabase
            .from('room_stays')
            .select('id, status')
            .eq('id', room_stay_id)
            .single();

        if (roomStayError || !roomStay || roomStay.status !== 'ACTIVA') {
            return NextResponse.json(
                { error: 'Invalid or inactive room stay' },
                { status: 404 }
            );
        }

        // Check if subscription already exists
        const { data: existing } = await supabase
            .from('guest_subscriptions')
            .select('id')
            .eq('room_stay_id', room_stay_id)
            .eq('is_active', true)
            .single();

        if (existing) {
            // Update existing subscription
            const { data, error } = await supabase
                .from('guest_subscriptions')
                .update({
                    subscription_data,
                    user_agent,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            return NextResponse.json({
                success: true,
                subscription_id: data.id,
                message: 'Subscription updated',
            });
        }

        // Create new subscription
        const { data, error } = await supabase
            .from('guest_subscriptions')
            .insert({
                room_stay_id,
                room_number,
                subscription_data,
                user_agent,
                subscribed_at: new Date().toISOString(),
                is_active: true,
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json({
            success: true,
            subscription_id: data.id,
            message: 'Subscription created',
        });
    } catch (error) {
        console.error('Error in subscribe API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

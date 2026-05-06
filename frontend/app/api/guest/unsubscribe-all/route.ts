
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { room_number } = body;

        if (!room_number) {
            return NextResponse.json(
                { error: 'Missing room_number' },
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

        // Mark all active subscriptions for this room as inactive
        const { error } = await supabase
            .from('guest_subscriptions')
            .update({
                is_active: false,
                updated_at: new Date().toISOString(),
            })
            
            ;

        if (error) {
            throw error;
        }

        return NextResponse.json({
            success: true,
            message: 'All subscriptions deactivated for room',
        });
    } catch (error) {
        console.error('Error in unsubscribe-all API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

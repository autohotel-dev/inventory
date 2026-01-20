import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { subscription, employeeId } = await req.json();

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Use the provided employeeId or fallback to user.id if applicable
        const targetEmployeeId = employeeId || user.id;

        console.log('Push Subscribe Attempt:', { 
            targetEmployeeId, 
            endpoint: subscription.endpoint,
            userAgent: req.headers.get('user-agent')
        });

        // Upsert subscription into the NEW table
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                employee_id: targetEmployeeId,
                subscription: subscription, // Store full object including keys
                user_agent: req.headers.get('user-agent') || 'unknown',
                updated_at: new Date().toISOString()
            }, { 
                onConflict: 'subscription->>endpoint'
            });

        if (error) {
            console.error('Database Error in Push Subscribe:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            return NextResponse.json({ 
                error: 'Database error', 
                message: error.message,
                code: error.code 
            }, { status: 500 });
        }

        console.log('Push Subscribe Success');

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Error in push subscribe route:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

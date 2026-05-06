import { apiClient } from '@/lib/api/client';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { subscription, employeeId } = await req.json();

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
        }

        // 1. Verify user is authenticated
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userRes = await apiClient.get('/system/auth/me', {
            headers: { Authorization: authHeader }
        }).catch((e: any) => ({ data: null }));
        const user = userRes.data;

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Save subscription via backend CRUD
        const targetEmployeeId = employeeId || user.id;

        await apiClient.post('/system/crud/push_subscriptions', {
            employee_id: targetEmployeeId,
            endpoint: subscription.endpoint, // Extract endpoint for unique constraint
            subscription: subscription, // Store full object including keys
            user_agent: req.headers.get('user-agent') || 'unknown',
            updated_at: new Date().toISOString()
        });

        console.log('Push Subscribe Success');

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('Error in push subscribe route:', e);
        return NextResponse.json({ 
            error: 'Internal server error',
            message: e?.message
        }, { status: 500 });
    }
}

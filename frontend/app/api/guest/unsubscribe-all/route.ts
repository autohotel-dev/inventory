import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api/client';

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

        const { data: subsData } = await apiClient.get('/system/crud/guest_subscriptions', {
            params: { room_number, is_active: true }
        });
        
        const subscriptions = Array.isArray(subsData) ? subsData : (subsData?.items || subsData?.results || []);

        for (const sub of subscriptions) {
            await apiClient.patch(`/system/crud/guest_subscriptions/${sub.id}`, {
                is_active: false,
                updated_at: new Date().toISOString()
            });
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

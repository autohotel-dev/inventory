import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api/client';

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

        // Verify the room stay exists and is active
        const { data: staysData } = await apiClient.get('/system/crud/room_stays', {
            params: { id: room_stay_id }
        });
        const stays = Array.isArray(staysData) ? staysData : (staysData?.items || staysData?.results || []);
        const roomStay = stays[0];

        if (!roomStay || roomStay.status !== 'ACTIVA') {
            return NextResponse.json(
                { error: 'Invalid or inactive room stay' },
                { status: 404 }
            );
        }

        // Check if subscription already exists
        const { data: subsData } = await apiClient.get('/system/crud/guest_subscriptions', {
            params: { room_stay_id }
        });
        const subscriptions = Array.isArray(subsData) ? subsData : (subsData?.items || subsData?.results || []);
        const existing = subscriptions[0];

        if (existing) {
            // Update existing subscription
            const { data: updatedSub } = await apiClient.patch(`/system/crud/guest_subscriptions/${existing.id}`, {
                subscription_data,
                user_agent,
                updated_at: new Date().toISOString(),
            });

            return NextResponse.json({
                success: true,
                subscription_id: updatedSub?.id || existing.id,
                message: 'Subscription updated',
            });
        }

        // Create new subscription
        const { data: newSub } = await apiClient.post('/system/crud/guest_subscriptions', {
            room_stay_id,
            room_number,
            subscription_data,
            user_agent,
            subscribed_at: new Date().toISOString(),
            is_active: true,
        });

        return NextResponse.json({
            success: true,
            subscription_id: newSub?.id,
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

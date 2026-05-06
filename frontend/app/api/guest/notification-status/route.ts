/**
 * API Route: Update Notification Status
 * POST /api/guest/notification-status
 * Updates delivery and opened status of notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api/client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { notification_id, delivered, opened } = body;

        if (!notification_id) {
            return NextResponse.json(
                { error: 'Missing notification_id' },
                { status: 400 }
            );
        }

        const updateData: any = {};

        if (typeof delivered === 'boolean') {
            updateData.delivered = delivered;
        }

        if (typeof opened === 'boolean') {
            updateData.opened = opened;
            if (opened) {
                updateData.opened_at = new Date().toISOString();
            }
        }

        await apiClient.patch(`/system/crud/guest_notifications/${notification_id}`, updateData);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating notification status:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

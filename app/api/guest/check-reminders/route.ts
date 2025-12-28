/**
 * API Route: Check Checkout Reminders (Cron Job)
 * GET /api/guest/check-reminders
 * Automated endpoint to send checkout reminders
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendCheckoutReminders } from '@/lib/services/guest-notification-service';

export async function GET(request: NextRequest) {
    try {
        // Verify cron secret (for Vercel Cron)
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Send checkout reminders (2 hours before)
        await sendCheckoutReminders(2);

        return NextResponse.json({
            success: true,
            message: 'Checkout reminders sent',
        });
    } catch (error) {
        console.error('Error in check-reminders cron:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

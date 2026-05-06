/**
 * API Route: Survey Management
 * GET  /api/guest/survey - Get active surveys
 * POST /api/guest/survey - Submit survey response
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api/client';

export async function GET() {
    try {
        // Get all active surveys
        const { data: surveysData } = await apiClient.get('/system/crud/surveys', {
            params: { is_active: true }
        });
        const surveys = Array.isArray(surveysData) ? surveysData : (surveysData?.items || surveysData?.results || []);

        return NextResponse.json({ surveys });
    } catch (error) {
        console.error('Error fetching surveys:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { survey_id, room_stay_id, room_number, responses, guest_feedback } = body;

        if (!survey_id || !room_number || !responses) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Insert survey response
        const { data: responseData } = await apiClient.post('/system/crud/survey_responses', {
            survey_id,
            room_stay_id,
            room_number,
            responses,
            guest_feedback,
            submitted_at: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            response_id: responseData?.id,
            message: 'Survey submitted successfully',
        });
    } catch (error) {
        console.error('Error submitting survey:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * API Route: Survey Management
 * GET  /api/guest/survey - Get active surveys
 * POST /api/guest/survey - Submit survey response
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
    try {
        const supabase = await createClient();

        // Get all active surveys
        const { data: surveys, error } = await supabase
            .from('surveys')
            .select('*')
            
            ;

        if (error) {
            throw error;
        }

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

        const supabase = await createClient();

        // Insert survey response
        const { data, error } = await supabase
            .from('survey_responses')
            .insert({
                survey_id,
                room_stay_id,
                room_number,
                responses,
                guest_feedback,
                submitted_at: new Date().toISOString(),
            })
            .select()
            ;

        if (error) {
            throw error;
        }

        return NextResponse.json({
            success: true,
            response_id: data.id,
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

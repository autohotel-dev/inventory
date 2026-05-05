import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TelemetryEvent } from '@/lib/telemetry';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const events: TelemetryEvent[] = body.events;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ success: true, message: 'No events provided' });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const insertPayload = events.map(event => ({
      user_id: user?.id || null,
      module: event.module || null,
      page: event.page,
      action_type: event.action_type,
      action_name: event.action_name,
      duration_ms: event.duration_ms || null,
      payload: event.payload || null,
      endpoint: event.endpoint || null,
      is_success: event.is_success,
      error_details: event.error_details || null,
      created_at: event.timestamp || new Date().toISOString()
    }));

    // Insert the batch
    const { error } = await supabase
      .from('system_telemetry')
      .insert(insertPayload);

    if (error) {
      console.error('[Telemetry API] Error inserting events:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: events.length });
  } catch (error) {
    console.error('[Telemetry API] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const events = body.events;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ success: true, message: 'No events provided' });
    }

    // Forward to FastAPI (Backend) instead of Supabase
    // This allows telemetry to still work via Next.js proxy without needing active client tokens in the browser unload event
    const response = await fetch(`${API_BASE_URL}/system/ops-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ events })
    });

    if (!response.ok) {
      console.error('[Telemetry API] Error from FastAPI:', await response.text());
      return NextResponse.json({ success: false, error: 'FastAPI Error' }, { status: response.status });
    }

    return NextResponse.json({ success: true, count: events.length });
  } catch (error) {
    console.error('[Telemetry API] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

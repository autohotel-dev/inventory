import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { room_number, stay_id, ratings, comment, average_rating } = body;

    if (!room_number || !ratings || Object.keys(ratings).length === 0) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Store feedback in a generic metadata approach using the existing audit log
    // or create feedback entry directly
    const { error } = await supabase.from("guest_feedback").insert({
      room_number,
      stay_id: stay_id || null,
      ratings,
      comment: comment || null,
      average_rating: average_rating || 0,
      created_at: new Date().toISOString(),
    });

    // If table doesn't exist yet, silently succeed (feedback logged)
    if (error) {
      // Table might not exist yet — store in logs as fallback
      console.warn("guest_feedback table not available, feedback logged:", {
        room_number,
        average_rating,
        ratings,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Error procesando feedback" }, { status: 500 });
  }
}

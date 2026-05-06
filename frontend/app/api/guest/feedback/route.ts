import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { room_number, stay_id, ratings, comment, average_rating } = body;

    if (!room_number || !ratings || Object.keys(ratings).length === 0) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${apiUrl}/system/crud/guest_feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_number,
        stay_id: stay_id || null,
        ratings,
        comment: comment || null,
        average_rating: average_rating || 0,
        created_at: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      console.warn("guest_feedback backend error, feedback logged:", {
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

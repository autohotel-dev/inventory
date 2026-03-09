"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function resetAllRooms() {
  const supabase = await createClient();

  // 1. Verify Admin Role
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: "No autorizado" };
  }

  // 2. Determine Role via Employees table (Source of Truth)
  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (employee?.role !== "admin") {
    return { success: false, error: "Requiere privilegios de administrador" };
  }

  try {
    // 2. Set all active stays to FINALIZADA
    const now = new Date().toISOString();
    
    // First, find all active stays to log or just update them
    const { data: updatedStays, error: staysError } = await supabase
      .from("room_stays")
      .update({
        status: "FINALIZADA",
        actual_check_out_at: now,
        notes: "Cierre forzado por administrador (Reinicio de Tablero)"
      })
      .neq("status", "FINALIZADA")
      .neq("status", "CANCELADA")
      .select('id');

    if (staysError) console.error("Error updating stays:", staysError);

    // 3. Reset all rooms to LIBRE
    const { data: updatedRooms, error: roomsError } = await supabase
      .from("rooms")
      .update({
        status: "LIBRE",
      })
      .neq("status", "LIBRE")
      .select('id');

    if (roomsError) console.error("Error updating rooms:", roomsError);

    const staysCount = updatedStays?.length || 0;
    const roomsCount = updatedRooms?.length || 0;

    console.log(`Reset Board: Updated ${staysCount} stays and ${roomsCount} rooms.`);

    // 4. Revalidate
    // 4. Revalidate
    revalidatePath("/", "layout");
    
    return { success: true, message: "Tablero reiniciado correctamente" };
  } catch (error) {
    console.error("Error resetting board:", error);
    return { success: false, error: "Error al reiniciar el tablero" };
  }
}

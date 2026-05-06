"use server";

import { apiClient } from "@/lib/api/client";
import { revalidatePath } from "next/cache";

export async function resetAllRooms() {
  try {
    // Verify admin role via API
    const { data: me } = await apiClient.get("/system/auth/me");
    if (!me || (me.role !== "admin")) {
      return { success: false, error: "Requiere privilegios de administrador" };
    }

    // Call the reset board API endpoint
    const { data: result } = await apiClient.post("/rooms/reset-board");

    // Revalidate
    revalidatePath("/", "layout");
    
    return { success: true, message: "Tablero reiniciado correctamente" };
  } catch (error) {
    console.error("Error resetting board:", error);
    return { success: false, error: "Error al reiniciar el tablero" };
  }
}

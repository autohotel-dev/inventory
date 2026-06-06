"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Room } from "@/components/sales/room-types";

// Fetch rooms via optimized server-side RPC
// Only returns ACTIVE stays (not the 2,500+ historical ones)
export const fetchRoomsData = async (): Promise<Room[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_rooms_dashboard");

  if (error) {
    console.error("Error loading rooms (RPC):", error);
    throw new Error(error.message);
  }

  const rooms = (data || []) as Room[];

  // ─── Resolve assigned employee names for TV icon initials ───────────
  // Strategy: 
  // 1. If assigned_employee_id is set (PENDIENTE_ENCENDIDO), resolve name from employees table
  // 2. If status is TV_ENCENDIDA but assigned_employee_id is null (DB clears it on confirm), 
  //    look up the last ASSIGNED/CONFIRMED log to find who did it

  const assignedIds = new Set<string>();
  const roomIdsNeedingLogLookup: string[] = [];

  for (const room of rooms) {
    for (const asset of room.room_assets || []) {
      if (asset.asset_type !== 'TV_REMOTE') continue;
      if (asset.assigned_employee_id) {
        assignedIds.add(asset.assigned_employee_id);
      } else if (asset.status === 'TV_ENCENDIDA') {
        // DB cleared the assignment — need to check audit logs
        roomIdsNeedingLogLookup.push(room.id);
      }
    }
  }

  // Batch 1: Resolve names for directly-assigned employees
  if (assignedIds.size > 0) {
    const { data: employees } = await supabase
      .from("employees")
      .select("id, first_name")
      .in("id", Array.from(assignedIds));

    if (employees && employees.length > 0) {
      const nameMap = new Map<string, string>(employees.map((e: { id: string; first_name: string }) => [e.id, e.first_name]));
      for (const room of rooms) {
        for (const asset of room.room_assets || []) {
          if (asset.assigned_employee_id) {
            asset.assigned_employee_name = nameMap.get(asset.assigned_employee_id) ?? null;
          }
        }
      }
    }
  }

  // Batch 2: For TV_ENCENDIDA rooms without assigned_employee_id, 
  // fetch the last relevant log to know who handled it
  if (roomIdsNeedingLogLookup.length > 0) {
    const { data: logs } = await supabase
      .from("room_asset_logs")
      .select("room_id, assigned_to_employee_id, action_type")
      .in("room_id", roomIdsNeedingLogLookup)
      .in("action_type", ["ASSIGNED_TO_COCHERO_FOR_TV", "CONFIRMED_TV_ON"])
      .order("created_at", { ascending: false })
      .limit(roomIdsNeedingLogLookup.length * 2);

    if (logs && logs.length > 0) {
      // Build a map: room_id -> cochero employee_id (most recent log wins)
      const roomEmployeeMap = new Map<string, string>();
      const logEmployeeIds = new Set<string>();
      for (const log of logs as any[]) {
        if (roomEmployeeMap.has(log.room_id)) continue;
        if (log.assigned_to_employee_id) {
          roomEmployeeMap.set(log.room_id, log.assigned_to_employee_id);
          logEmployeeIds.add(log.assigned_to_employee_id);
        }
      }

      // Resolve names for these employee IDs
      if (logEmployeeIds.size > 0) {
        const { data: logEmployees } = await supabase
          .from("employees")
          .select("id, first_name")
          .in("id", Array.from(logEmployeeIds));

        if (logEmployees && logEmployees.length > 0) {
          const logNameMap = new Map<string, string>(logEmployees.map((e: { id: string; first_name: string }) => [e.id, e.first_name]));
          for (const room of rooms) {
            const tvAsset = room.room_assets?.find(a => a.asset_type === 'TV_REMOTE' && a.status === 'TV_ENCENDIDA' && !a.assigned_employee_id);
            const empId = roomEmployeeMap.get(room.id);
            if (tvAsset && empId) {
              tvAsset.assigned_employee_name = logNameMap.get(empId) ?? null;
            }
          }
        }
      }
    }
  }

  // The RPC already returns sorted data (non-hotel first, then by number)
  return rooms;
};

export function useRoomsQuery() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["rooms"],
    queryFn: fetchRoomsData,
    staleTime: 1000 * 5, // 5 segundos, ya que la visibilidad depende de web sockets
    refetchOnWindowFocus: true,
  });

  // Helper para forzar recarga (el equivalente a "silent" fetch o click a botón reload)
  const refreshRooms = async (silent: boolean = false) => {
    await queryClient.invalidateQueries({ queryKey: ["rooms"] });
  };

  return {
    rooms: query.data || [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refreshRooms,
  };
}

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

  // The RPC already returns sorted data (non-hotel first, then by number)
  return (data || []) as Room[];
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

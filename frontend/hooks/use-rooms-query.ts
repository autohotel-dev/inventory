"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Room } from "@/components/sales/room-types";

// Helper to fetch rooms directly from FastAPI (BFF pattern)
export const fetchRoomsData = async (): Promise<Room[]> => {
  const { data } = await apiClient.get<Room[]>('/rooms/dashboard');

  // Ordenar: primero las que NO son tipo Torre/Hotel, luego las Torre
  // Dentro de cada grupo, ordenar por número
  const sortedRooms = data.sort((a, b) => {
    const aIsHotel = a.is_hotel === true;
    const bIsHotel = b.is_hotel === true;

    if (aIsHotel === bIsHotel) {
      const numA = parseInt(a.number, 10);
      const numB = parseInt(b.number, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.number.localeCompare(b.number);
    }
    // aIsHotel !== bIsHotel
    return aIsHotel ? 1 : -1;
  });

  return sortedRooms;
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

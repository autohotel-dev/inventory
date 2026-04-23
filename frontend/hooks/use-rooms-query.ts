"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Room } from "@/components/sales/room-types";

// Helper to fetch rooms directly from Supabase
export const fetchRoomsData = async (): Promise<Room[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rooms")
    .select(
      `id, number, status, notes, room_types:room_type_id ( id, name, base_price, weekday_hours, weekend_hours, is_hotel, extra_person_price, extra_hour_price, max_people ), room_stays ( id, sales_order_id, status, check_in_at, expected_check_out_at, current_people, total_people, tolerance_started_at, tolerance_type, vehicle_plate, vehicle_brand, vehicle_model, valet_employee_id, checkout_valet_employee_id, valet_checkout_requested_at, vehicle_requested_at, guest_access_token, checkout_payment_data, sales_orders ( id, remaining_amount, payments ( id, status, confirmed_at ), sales_order_items ( id, delivery_status, concept_type, created_at ) ) ), room_assets ( id, asset_type, status, assigned_employee_id )`
    );

  if (error) {
    console.error("Error loading rooms:", error);
    throw new Error(error.message);
  }

  // Ordenar: primero las que NO son tipo Torre/Hotel, luego las Torre
  // Dentro de cada grupo, ordenar por número
  const sortedRooms = (data as any[])?.sort((a, b) => {
    const aIsHotel = a.room_types?.is_hotel === true;
    const bIsHotel = b.room_types?.is_hotel === true;

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

  return sortedRooms as Room[];
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

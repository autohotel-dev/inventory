"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, DollarSign, DoorOpen, Sparkles, Lock, Unlock, Info, MoreVertical, FileText, Clock } from "lucide-react";
import { toast } from "sonner";

interface RoomType {
  id: string;
  name: string;
  base_price?: number;
  weekday_hours?: number;
  weekend_hours?: number;
  is_hotel?: boolean;
  extra_person_price?: number;
  extra_hour_price?: number;
  max_people?: number;
}

interface Room {
  id: string;
  number: string;
  status: "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA" | string;
  room_types: RoomType | null;
  room_stays?: {
    id: string;
    sales_order_id: string;
    status: string;
    expected_check_out_at?: string | null;
    sales_orders?: {
      remaining_amount: number;
    } | null;
    current_people?: number;
    total_people?: number;
  }[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  LIBRE: {
    label: "Libre",
    color: "bg-blue-950/50 text-blue-100 border-blue-400/40",
  },
  OCUPADA: {
    label: "Ocupada",
    color: "bg-red-950/50 text-red-100 border-red-400/40",
  },
  SUCIA: {
    label: "Sucia",
    color: "bg-purple-950/50 text-purple-100 border-purple-400/40",
  },
  BLOQUEADA: {
    label: "Bloqueada",
    color: "bg-emerald-950/50 text-emerald-100 border-emerald-400/40",
  },
};

const ROOM_STATUS_BG: Record<string, string> = {
  LIBRE: "bg-blue-900/80",
  OCUPADA: "bg-red-900/80",
  SUCIA: "bg-purple-900/80",
  BLOQUEADA: "bg-emerald-900/80",
};

// Anillo suave por estado para las cards (no se usa en el dock)
const ROOM_STATUS_ACCENT: Record<string, string> = {
  LIBRE: "ring-1 ring-blue-500/40",
  OCUPADA: "ring-1 ring-red-500/40",
  SUCIA: "ring-1 ring-purple-500/40",
  BLOQUEADA: "ring-1 ring-emerald-500/40",
};

export function RoomsBoard() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showStartStayModal, setShowStartStayModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutAmount, setCheckoutAmount] = useState<number>(0);
  const [checkoutInfo, setCheckoutInfo] = useState<{
    salesOrderId: string;
    remainingAmount: number;
  } | null>(null);
  const [reminderNotifiedStayIds20, setReminderNotifiedStayIds20] = useState<string[]>([]);
  const [reminderNotifiedStayIds5, setReminderNotifiedStayIds5] = useState<string[]>([]);
  const [reminderAlert, setReminderAlert] = useState<{
    roomNumber: string;
    minutes: number;
    level: "20" | "5";
  } | null>(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [actionsDockVisible, setActionsDockVisible] = useState(false);

  const fetchRooms = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("rooms")
        .select(
          `id, number, status, room_types:room_type_id ( id, name, base_price, weekday_hours, weekend_hours, is_hotel, extra_person_price, extra_hour_price, max_people ), room_stays ( id, sales_order_id, status, expected_check_out_at, current_people, total_people, sales_orders ( remaining_amount ) )`
        )
        .order("number", { ascending: true });

      if (error) {
        console.error("Error loading rooms:", error);
        setRooms([]);
        return;
      }

      setRooms((data as any) || []);
    } catch (err) {
      console.error("Error fetching rooms:", err);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePeople = async (room: Room, delta: 1 | -1) => {
    if (room.status !== "OCUPADA") return;

    const activeStay = (room.room_stays || []).find(
      (stay) => stay.status === "ACTIVA"
    ) || null;
    if (!activeStay) {
      toast.error("No se encontró una estancia activa para esta habitación", {
        description:
          "Revisa la tabla room_stays: no hay registro ACTIVA vinculado a esta habitación.",
      });
      return;
    }

    if (!room.room_types) {
      toast.error("No se encontró el tipo de habitación", {
        description: "Verifica la relación room_type_id para esta habitación.",
      });
      return;
    }

    const maxPeople = room.room_types.max_people ?? 2;
    const current = activeStay.current_people ?? 2;
    const next = current + delta;

    if (next < 1) {
      toast.error("No puede haber menos de 1 persona en la habitación");
      return;
    }

    if (next > maxPeople) {
      toast.error("Límite de personas excedido", {
        description: `Máximo ${maxPeople} personas para ${room.room_types.name}`,
      });
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
      // Actualizar personas en room_stays
      const newCurrentPeople = next;
      const newTotalPeople = Math.max(activeStay.total_people ?? current, newCurrentPeople);

      const { error: stayError } = await supabase
        .from("room_stays")
        .update({
          current_people: newCurrentPeople,
          total_people: newTotalPeople,
        })
        .eq("id", activeStay.id);

      if (stayError) {
        console.error("Error updating people count in room_stays:", stayError);
        toast.error("No se pudo actualizar el número de personas");
        return;
      }

      // Si se agrega una persona extra (por encima de las 2 incluidas), cobrar extra
      if (delta === 1 && newCurrentPeople > 2) {
        const extraPrice = room.room_types.extra_person_price ?? 0;

        if (extraPrice <= 0) {
          toast.warning("No se configuró el precio de persona extra para este tipo", {
            description: `Tipo: ${room.room_types.name}`,
          });
        } else {
          const { data: orderData, error: orderError } = await supabase
            .from("sales_orders")
            .select("subtotal, tax, paid_amount")
            .eq("id", activeStay.sales_order_id)
            .single();

          if (orderError || !orderData) {
            console.error("Error fetching sales order for extra person:", orderError);
            toast.error("No se pudo actualizar la venta para la persona extra");
          } else {
            const subtotal = Number(orderData.subtotal) || 0;
            const tax = Number(orderData.tax) || 0;
            const paidAmount = Number(orderData.paid_amount) || 0;

            const newSubtotal = subtotal + extraPrice;
            const newTotal = newSubtotal + tax;
            const newRemaining = Math.max(newTotal - paidAmount, 0);

            const { error: updateOrderError } = await supabase
              .from("sales_orders")
              .update({
                subtotal: newSubtotal,
                total: newTotal,
                remaining_amount: newRemaining,
              })
              .eq("id", activeStay.sales_order_id);

            if (updateOrderError) {
              console.error("Error updating sales order for extra person:", updateOrderError);
              toast.error("No se pudo actualizar el saldo por persona extra");
            } else {
              toast.success("Persona extra registrada", {
                description: `Hab. ${room.number} ahora tiene ${newCurrentPeople} personas. Se agregó ${extraPrice.toFixed(
                  2
                )} MXN al saldo.`,
              });
            }
          }
        }
      } else {
        toast.success("Personas actualizadas", {
          description: `Hab. ${room.number}: ahora hay ${newCurrentPeople} personas.`,
        });
      }

      await fetchRooms();
    } catch (error) {
      console.error("Error updating people for room:", error);
      toast.error("Error al actualizar las personas de la habitación");
    } finally {
      setActionLoading(false);
    }
  };

  const openCheckoutModal = async (room: Room) => {
    const activeStay = (room.room_stays || []).find(
      (stay) => stay.status === "ACTIVA"
    );

    if (!activeStay) {
      toast.error("No se encontró una estancia activa para esta habitación", {
        description:
          "Revisa la tabla room_stays: no hay registro ACTIVA vinculado a esta habitación.",
      });
      return;
    }

    const supabase = createClient();

    try {
      // 1) Calcular horas extra si ya se pasó de la hora de salida estimada
      let extraHours = 0;
      if (activeStay.expected_check_out_at && room.room_types) {
        const expected = new Date(activeStay.expected_check_out_at);
        const now = new Date();
        const diffMs = now.getTime() - expected.getTime();

        if (diffMs > 0) {
          extraHours = Math.ceil(diffMs / (60 * 60 * 1000));
        }
      }

      // 2) Si hay horas extra y precio configurado, actualizar totales de la venta
      if (extraHours > 0 && room.room_types?.extra_hour_price && room.room_types.extra_hour_price > 0) {
        const extraHourPrice = room.room_types.extra_hour_price;

        const { data: orderData, error: orderError } = await supabase
          .from("sales_orders")
          .select("subtotal, tax, paid_amount")
          .eq("id", activeStay.sales_order_id)
          .single();

        if (orderError || !orderData) {
          console.error("Error fetching sales order for extra hours:", orderError);
          toast.error("No se pudo actualizar la venta para las horas extra");
        } else {
          const subtotal = Number(orderData.subtotal) || 0;
          const tax = Number(orderData.tax) || 0;
          const paidAmount = Number(orderData.paid_amount) || 0;

          const extraAmount = extraHours * extraHourPrice;
          const newSubtotal = subtotal + extraAmount;
          const newTotal = newSubtotal + tax;
          const newRemaining = Math.max(newTotal - paidAmount, 0);

          const { error: updateOrderError } = await supabase
            .from("sales_orders")
            .update({
              subtotal: newSubtotal,
              total: newTotal,
              remaining_amount: newRemaining,
            })
            .eq("id", activeStay.sales_order_id);

          if (updateOrderError) {
            console.error("Error updating sales order for extra hours:", updateOrderError);
            toast.error("No se pudo actualizar el saldo por horas extra");
          } else {
            toast.success("Horas extra registradas", {
              description: `Se agregaron ${extraHours} hora(s) extra a la habitación ${room.number}.`,
            });
          }
        }
      }

      // 3) Leer el saldo pendiente actualizado para mostrar en el modal
      const { data: order, error } = await supabase
        .from("sales_orders")
        .select("remaining_amount")
        .eq("id", activeStay.sales_order_id)
        .single();

      if (error || !order) {
        console.error("Error fetching sales order for checkout:", error);
        toast.error("No se pudo obtener el saldo pendiente de la venta");
        return;
      }

      setCheckoutInfo({
        salesOrderId: activeStay.sales_order_id,
        remainingAmount: Number(order.remaining_amount) || 0,
      });
      setCheckoutAmount(Number(order.remaining_amount) || 0);
      setSelectedRoom(room);
      setShowCheckoutModal(true);
    } catch (e) {
      console.error("Error opening checkout modal:", e);
      toast.error("No se pudo preparar el check-out");
    }
  };

  const handleCloseCheckoutModal = () => {
    if (actionLoading) return;
    setShowCheckoutModal(false);
    setSelectedRoom(null);
    setCheckoutInfo(null);
    setCheckoutAmount(0);
  };

  const handleCheckout = async () => {
    if (!checkoutInfo || !selectedRoom) return;

    const amount = Number(checkoutAmount) || 0;
    setActionLoading(true);
    const supabase = createClient();

    try {
      // Si ya no hay saldo pendiente, hacer sólo el check-out sin intentar cobrar
      if (checkoutInfo.remainingAmount <= 0 || amount <= 0) {
        const activeStay = (selectedRoom.room_stays || []).find(
          (stay) => stay.status === "ACTIVA"
        );

        if (activeStay) {
          const now = new Date().toISOString();

          await supabase
            .from("room_stays")
            .update({
              status: "FINALIZADA",
              actual_check_out_at: now,
            })
            .eq("id", activeStay.id);
        }

        await supabase
          .from("rooms")
          .update({ status: "SUCIA" })
          .eq("id", selectedRoom.id);

        await supabase
          .from("sales_orders")
          .update({ status: "ENDED" })
          .eq("id", checkoutInfo.salesOrderId);

        toast.success("Check-out completado", {
          description: `La habitación ${selectedRoom.number} pasó a estado SUCIA`,
        });
      } else {
        // Hay saldo pendiente: procesar pago normalmente
        const { data, error } = await supabase.rpc("process_payment", {
          order_id: checkoutInfo.salesOrderId,
          payment_amount: amount,
        });

        if (error) {
          console.error("Error processing payment from POS:", error);
          toast.error("Error al procesar el pago");
          return;
        }

        const result = (data as any)?.[0];

        if (result && result.success === false) {
          toast.error(result.message || "No se pudo procesar el pago");
          return;
        }

        // Volver a leer la orden para saber si quedó saldo pendiente
        const { data: orderAfter } = await supabase
          .from("sales_orders")
          .select("remaining_amount, status")
          .eq("id", checkoutInfo.salesOrderId)
          .single();

        const remaining = Number(orderAfter?.remaining_amount) || 0;

        // Si ya no hay saldo pendiente, cerrar estancia y marcar habitación como SUCIA
        if (remaining <= 0) {
          const activeStay = (selectedRoom.room_stays || []).find(
            (stay) => stay.status === "ACTIVA"
          );

          if (activeStay) {
            const now = new Date().toISOString();

            await supabase
              .from("room_stays")
              .update({
                status: "FINALIZADA",
                actual_check_out_at: now,
              })
              .eq("id", activeStay.id);
          }

          await supabase
            .from("rooms")
            .update({ status: "SUCIA" })
            .eq("id", selectedRoom.id);

          await supabase
            .from("sales_orders")
            .update({ status: "ENDED" })
            .eq("id", checkoutInfo.salesOrderId);

          toast.success("Check-out completado", {
            description: `La habitación ${selectedRoom.number} pasó a estado SUCIA`,
          });
        } else {
          toast.success("Pago registrado", {
            description: `Saldo restante: ${remaining.toFixed(2)} MXN`,
          });
        }
      }

      setShowCheckoutModal(false);
      setSelectedRoom(null);
      setCheckoutInfo(null);
      setCheckoutAmount(0);
      await fetchRooms();
    } catch (error) {
      console.error("Error durante el check-out desde POS:", error);
      toast.error("Error al realizar el check-out");
    } finally {
      setActionLoading(false);
    }
  };

  const updateRoomStatus = async (
    room: Room,
    newStatus: "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA",
    successMessage: string
  ) => {
    setActionLoading(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("rooms")
        .update({ status: newStatus })
        .eq("id", room.id);

      if (error) {
        console.error("Error updating room status:", error);
        toast.error("No se pudo actualizar el estado de la habitación");
        return;
      }

      toast.success(successMessage);
      await fetchRooms();
    } catch (error) {
      console.error("Error updating room status:", error);
      toast.error("Ocurrió un error al actualizar la habitación");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  // Recordatorios 20 minutos antes de la salida
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        rooms.forEach((room) => {
          if (room.status !== "OCUPADA") return;
          const activeStay = getActiveStay(room);
          if (!activeStay || !activeStay.expected_check_out_at) return;

          const checkout = new Date(activeStay.expected_check_out_at);
          const now = new Date();
          const diffMs = checkout.getTime() - now.getTime();
          const diffMinutes = Math.floor(diffMs / 60000);

          // Aviso 20 minutos antes
          if (
            diffMinutes <= 20 &&
            diffMinutes > 5 &&
            !reminderNotifiedStayIds20.includes(activeStay.id)
          ) {
            setReminderNotifiedStayIds20((prev) => [...prev, activeStay.id]);
            toast.warning("Habitación próxima a vencer", {
              description: `La habitación ${room.number} está por terminar su tiempo. Restante: ${diffMinutes} minutos`,
            });
            setReminderAlert({ roomNumber: room.number, minutes: diffMinutes, level: "20" });
          }

          // Aviso 5 minutos antes, con sonido opcional
          if (
            diffMinutes <= 5 &&
            diffMinutes > 0 &&
            !reminderNotifiedStayIds5.includes(activeStay.id)
          ) {
            setReminderNotifiedStayIds5((prev) => [...prev, activeStay.id]);
            toast.error("Habitación a punto de vencer", {
              description: `La habitación ${room.number} está por terminar su tiempo. Restante: ${diffMinutes} minutos`,
            });

            try {
              const audio = new Audio("/room-alert.mp3");
              audio.play().catch(() => {
                // Ignorar errores de reproducción (por permisos del navegador)
              });
            } catch (e) {
              console.error("Error reproduciendo sonido de alerta", e);
            }

            setReminderAlert({ roomNumber: room.number, minutes: diffMinutes, level: "5" });
          }
        });
      } catch (e) {
        console.error("Error checking room reminders", e);
      }
    }, 60000); // Revisar cada minuto

    return () => clearInterval(interval);
  }, [rooms, reminderNotifiedStayIds20, reminderNotifiedStayIds5]);

  const calculateExpectedCheckout = (roomType: RoomType) => {
    const now = new Date();

    if (roomType.is_hotel) {
      // Hotel (Torre): check-out siempre a las 12 pm del día siguiente
      const checkout = new Date(now);
      checkout.setDate(checkout.getDate() + 1);
      checkout.setHours(12, 0, 0, 0);
      return checkout;
    }

    // Motel: 12h entre semana, 8h fin de semana (viernes y sábado)
    const day = now.getDay(); // 0 = Domingo ... 6 = Sábado
    const isWeekend = day === 5 || day === 6; // Viernes, Sábado

    const hours = isWeekend
      ? roomType.weekend_hours ?? 8
      : roomType.weekday_hours ?? 12;

    const checkout = new Date(now);
    checkout.setHours(checkout.getHours() + hours);
    return checkout;
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActiveStay = (room: Room) => {
    return (room.room_stays || []).find((stay) => stay.status === "ACTIVA") || null;
  };

  const getRemainingTimeLabel = (room: Room) => {
    const activeStay = getActiveStay(room);
    if (!activeStay || !activeStay.expected_check_out_at) return null;

    const now = new Date();
    const checkout = new Date(activeStay.expected_check_out_at);
    const diffMs = checkout.getTime() - now.getTime();

    const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0);
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    const labelParts = [] as string[];
    if (hours > 0) labelParts.push(`${hours}h`);
    labelParts.push(`${minutes}m`);

    return {
      eta: formatDateTime(checkout),
      remaining: labelParts.join(" "),
      minutesToCheckout: diffMinutes,
    };
  };

  const getExtraHoursLabel = (room: Room) => {
    const activeStay = getActiveStay(room);
    if (!activeStay || !activeStay.expected_check_out_at) return 0;

    const expected = new Date(activeStay.expected_check_out_at);
    const now = new Date();
    const diffMs = now.getTime() - expected.getTime();

    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (60 * 60 * 1000));
  };

  const handleAddExtraHour = async (room: Room) => {
    if (room.status !== "OCUPADA") return;

    const activeStay = (room.room_stays || []).find(
      (stay) => stay.status === "ACTIVA"
    ) || null;

    if (!activeStay) {
      toast.error("No se encontró una estancia activa para esta habitación", {
        description:
          "Revisa la tabla room_stays: no hay registro ACTIVA vinculado a esta habitación.",
      });
      return;
    }

    if (!room.room_types || !room.room_types.extra_hour_price || room.room_types.extra_hour_price <= 0) {
      toast.error("No se configuró el precio de hora extra para este tipo de habitación");
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
      const extraHourPrice = room.room_types.extra_hour_price;

      const { data: orderData, error: orderError } = await supabase
        .from("sales_orders")
        .select("subtotal, tax, paid_amount")
        .eq("id", activeStay.sales_order_id)
        .single();

      if (orderError || !orderData) {
        console.error("Error fetching sales order for manual extra hour:", orderError);
        toast.error("No se pudo actualizar la venta para la hora extra");
        return;
      }

      const subtotal = Number(orderData.subtotal) || 0;
      const tax = Number(orderData.tax) || 0;
      const paidAmount = Number(orderData.paid_amount) || 0;

      const newSubtotal = subtotal + extraHourPrice;
      const newTotal = newSubtotal + tax;
      const newRemaining = Math.max(newTotal - paidAmount, 0);

      const { error: updateOrderError } = await supabase
        .from("sales_orders")
        .update({
          subtotal: newSubtotal,
          total: newTotal,
          remaining_amount: newRemaining,
        })
        .eq("id", activeStay.sales_order_id);

      if (updateOrderError) {
        console.error("Error updating sales order for manual extra hour:", updateOrderError);
        toast.error("No se pudo actualizar el saldo por hora extra");
        return;
      }

      toast.success("Hora extra agregada", {
        description: `Se agregó 1 hora extra a la habitación ${room.number}.`,
      });

      await fetchRooms();
    } catch (error) {
      console.error("Error adding manual extra hour:", error);
      toast.error("Error al agregar la hora extra");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoomClick = (room: Room) => {
    // Ya no hace nada al click general; se usan los botones Info y Acciones.
    return;
  };

  const openActionsDock = (room: Room) => {
    setSelectedRoom(room);
    setShowActionsModal(true);
    setActionsDockVisible(false);
    // Iniciar animación en el siguiente frame
    requestAnimationFrame(() => setActionsDockVisible(true));
  };

  const closeActionsDock = () => {
    if (actionLoading) return;
    setActionsDockVisible(false);
    // Esperar a que termine la transición antes de desmontar
    setTimeout(() => {
      setShowActionsModal(false);
    }, 200);
  };

  const handleCloseModal = () => {
    if (actionLoading) return;
    setShowStartStayModal(false);
    setSelectedRoom(null);
  };

  const handleStartStay = async () => {
    if (!selectedRoom || !selectedRoom.room_types) return;

    setActionLoading(true);
    const supabase = createClient();

    try {
      const roomType = selectedRoom.room_types;
      const now = new Date();
      const expectedCheckout = calculateExpectedCheckout(roomType);

      const basePrice = roomType.base_price ?? 0;

      // Obtener almacén específico para ventas de recepción (ALM002-R)
      const { data: defaultWarehouse, error: warehouseError } = await supabase
        .from("warehouses")
        .select("id, code, is_active")
        .eq("code", "ALM002-R")
        .eq("is_active", true)
        .single();

      if (warehouseError || !defaultWarehouse) {
        console.error("Error fetching default warehouse ALM002-R:", warehouseError);
        toast.error("No se encontró el almacén de recepción", {
          description:
            "Verifica que exista el almacén con código ALM002-R y esté activo.",
        });
        return;
      }

      // Obtener usuario actual (opcional, para created_by)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Crear orden de venta básica para la estancia
      const { data: salesOrder, error: orderError } = await supabase
        .from("sales_orders")
        .insert({
          customer_id: null,
          warehouse_id: defaultWarehouse.id,
          currency: "MXN",
          notes: `Estancia ${roomType.name} Hab. ${selectedRoom.number}`,
          subtotal: basePrice,
          tax: 0,
          total: basePrice,
          status: "OPEN",
          remaining_amount: 0,
          paid_amount: basePrice,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error("Error creating sales order:", orderError);
        toast.error("Error al iniciar la estancia", {
          description: "No se pudo crear la orden de venta.",
        });
        return;
      }

      // Registrar la estancia de habitación
      const { error: stayError } = await supabase.from("room_stays").insert({
        room_id: selectedRoom.id,
        sales_order_id: salesOrder.id,
        check_in_at: now.toISOString(),
        expected_check_out_at: expectedCheckout.toISOString(),
      });

      if (stayError) {
        console.error("Error creating room stay:", stayError);
        toast.error("Error al registrar la estancia", {
          description: "La orden se creó, pero hubo un problema registrando la estancia.",
        });
        return;
      }

      // Actualizar estado de la habitación a OCUPADA
      const { error: roomError } = await supabase
        .from("rooms")
        .update({ status: "OCUPADA" })
        .eq("id", selectedRoom.id);

      if (roomError) {
        console.error("Error updating room status:", roomError);
        toast.error("Error al actualizar la habitación", {
          description: "La estancia se creó, pero no se pudo actualizar el estado de la habitación.",
        });
        return;
      }

      toast.success("Estancia iniciada", {
        description: `Hab. ${selectedRoom.number} - ${roomType.name} hasta ${formatDateTime(
          expectedCheckout
        )}`,
      });

      setShowStartStayModal(false);
      setSelectedRoom(null);
      await fetchRooms();
    } catch (error) {
      console.error("Error starting stay:", error);
      toast.error("Error al iniciar la estancia", {
        description: "Ocurrió un error inesperado. Intenta nuevamente.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || {
      label: status,
      color: "bg-muted text-muted-foreground border-border",
    };

    return (
      <Badge
        variant="outline"
        className={`text-xs font-medium border ${config.color}`}
      >
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tablero de Habitaciones</h1>
          <RefreshCw className="h-5 w-5 animate-spin" />
        </div>
        <p className="text-muted-foreground">Cargando habitaciones...</p>
      </div>
    );
  }

  if (!rooms.length) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tablero de Habitaciones</h1>
          <Button variant="outline" size="sm" onClick={fetchRooms}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Recargar
          </Button>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay habitaciones registradas. Crea registros en la tabla
            <span className="font-semibold"> rooms </span>
            en Supabase.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tablero de Habitaciones</h1>
          <p className="text-muted-foreground text-sm">
            Vista general de todas las habitaciones como tablero físico.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRooms}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Recargar
        </Button>
      </div>

      {/* Mini-dashboard de contadores por estado */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-blue-500/40 bg-blue-950/30">
          <CardContent className="py-3 px-4 flex flex-col gap-1">
            <span className="text-xs text-blue-200">Libres</span>
            <span className="text-xl font-bold text-blue-100">
              {rooms.filter((r) => r.status === "LIBRE").length}
            </span>
          </CardContent>
        </Card>
        <Card className="border-red-500/40 bg-red-950/30">
          <CardContent className="py-3 px-4 flex flex-col gap-1">
            <span className="text-xs text-red-200">Ocupadas</span>
            <span className="text-xl font-bold text-red-100">
              {rooms.filter((r) => r.status === "OCUPADA").length}
            </span>
          </CardContent>
        </Card>
        <Card className="border-purple-500/40 bg-purple-950/30">
          <CardContent className="py-3 px-4 flex flex-col gap-1">
            <span className="text-xs text-purple-200">Sucias</span>
            <span className="text-xl font-bold text-purple-100">
              {rooms.filter((r) => r.status === "SUCIA").length}
            </span>
          </CardContent>
        </Card>
        <Card className="border-green-500/40 bg-green-950/30">
          <CardContent className="py-3 px-4 flex flex-col gap-1">
            <span className="text-xs text-green-200">Bloqueadas</span>
            <span className="text-xl font-bold text-green-100">
              {rooms.filter((r) => r.status === "BLOQUEADA").length}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Leyenda de colores */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-blue-500" />
          <span>Libre</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-red-500" />
          <span>Ocupada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-purple-500" />
          <span>Sucia</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-green-500" />
          <span>Bloqueada</span>
        </div>
      </div>

      {/* Grid único de habitaciones */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {rooms.map((room) => {
              const status = room.status || "OTRO";
              const timeInfo = status === "OCUPADA" ? getRemainingTimeLabel(room) : null;
              const activeStay = status === "OCUPADA" ? getActiveStay(room) : null;
              const hasPendingAmount =
                !!activeStay &&
                typeof activeStay.sales_orders?.remaining_amount === "number" &&
                Number(activeStay.sales_orders.remaining_amount) > 0;
              const extraHours = status === "OCUPADA" ? getExtraHoursLabel(room) : 0;

              return (
                <div
                  key={room.id}
                  className={`border border-white/5 rounded-lg px-3 py-2 text-sm flex flex-col justify-between h-20 cursor-pointer shadow-sm hover:shadow-md hover:border-white/20 backdrop-blur-sm transition-colors ${
                    ROOM_STATUS_BG[status] || "bg-slate-900/80"
                  } ${ROOM_STATUS_ACCENT[status] || ""}`}
                  onClick={() => handleRoomClick(room)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-base leading-none">{room.number}</span>
                    {renderStatusBadge(status)}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 rounded-full bg-transparent hover:bg-white/10 text-white/80 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoom(room);
                        setShowInfoModal(true);
                      }}
                    >
                      <Info className="h-3 w-3 text-white" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0 rounded-full border-white/60 bg-black/20 hover:bg-black/40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoom(room);
                        openActionsDock(room);
                      }}
                    >
                      <MoreVertical className="h-3 w-3 text-white" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {showStartStayModal && selectedRoom && selectedRoom.room_types && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Iniciar estancia</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseModal}
                disabled={actionLoading}
              >
                ✕
              </Button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Habitación</p>
                <p className="text-base font-semibold">
                  Hab. {selectedRoom.number} – {selectedRoom.room_types.name}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Precio base</p>
                <p className="text-base font-semibold">
                  $ {selectedRoom.room_types.base_price?.toFixed(2) ?? "0.00"} MXN
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Salida estimada</p>
                <p className="text-base font-medium">
                  {formatDateTime(
                    calculateExpectedCheckout(selectedRoom.room_types)
                  )}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Se creará una orden de venta en estado "Abierta" vinculada a esta habitación.
              </p>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCloseModal}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button onClick={handleStartStay} disabled={actionLoading}>
                {actionLoading ? "Iniciando..." : "Iniciar estancia"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {showInfoModal && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-center">
              Habitación {selectedRoom.number}
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              Tipo: <span className="font-semibold">{selectedRoom.room_types?.name || "Sin tipo"}</span>
            </p>
            {selectedRoom.status === "OCUPADA" && (() => {
              const activeStay = getActiveStay(selectedRoom);
              const timeInfo = getRemainingTimeLabel(selectedRoom);
              const extraHours = getExtraHoursLabel(selectedRoom);
              const currentPeople = activeStay?.current_people ?? 2;
              const maxPeople = selectedRoom.room_types?.max_people ?? 2;
              const remainingAmount = Number(
                activeStay?.sales_orders?.remaining_amount ?? 0
              );

              return (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    Personas: <span className="font-semibold">{currentPeople}</span> / {maxPeople}
                  </p>
                  {timeInfo && (
                    <>
                      <p>
                        Salida estimada: <span className="font-semibold">{timeInfo.eta}</span>
                      </p>
                      <p>
                        Tiempo restante: <span className="font-semibold">{timeInfo.remaining}</span>
                      </p>
                    </>
                  )}
                  {extraHours > 0 && (
                    <p>
                      Horas extra: <span className="font-semibold">{extraHours}h</span>
                    </p>
                  )}
                  <p>
                    Saldo pendiente: {remainingAmount.toFixed(2)} MXN
                  </p>
                </div>
              );
            })()}
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => setShowInfoModal(false)}
                disabled={actionLoading}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
      {showCheckoutModal && selectedRoom && checkoutInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cobrar / Check-out</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseCheckoutModal}
                disabled={actionLoading}
              >
                ✕
              </Button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Habitación</p>
                <p className="text-base font-semibold">
                  Hab. {selectedRoom.number} – {selectedRoom.room_types?.name}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Saldo pendiente</p>
                <p className="text-base font-semibold">
                  {checkoutInfo.remainingAmount.toFixed(2)} MXN
                </p>
              </div>
              {checkoutInfo.remainingAmount > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Monto a cobrar ahora</p>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={checkoutAmount}
                    onChange={(e) =>
                      setCheckoutAmount(parseFloat(e.target.value) || 0)
                    }
                    className="w-full border rounded px-3 py-2 bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deja el monto igual al saldo pendiente para hacer el check-out completo.
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCloseCheckoutModal}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button onClick={handleCheckout} disabled={actionLoading}>
                {actionLoading
                  ? "Procesando..."
                  : checkoutInfo.remainingAmount <= 0
                    ? "Dar salida"
                    : "Confirmar pago"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {showActionsModal && selectedRoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={closeActionsDock}
        >
          <div
            className={`relative w-72 h-72 rounded-full bg-slate-950/80 border border-white/15 backdrop-blur-lg flex items-center justify-center shadow-xl transform transition-all duration-200 ease-out ${
              actionsDockVisible ? "scale-100 opacity-100" : "scale-75 opacity-0"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Círculo central con info básica */}
            <div className="w-32 h-32 rounded-full bg-background/90 border border-white/30 flex flex-col items-center justify-center text-center px-2 overflow-hidden">
              <div className="text-xs text-muted-foreground leading-none mb-1">Hab.</div>
              <div className="text-2xl font-bold leading-none mb-1 truncate max-w-[7rem]">
                {selectedRoom.number}
              </div>
              <div className="mt-1 scale-100">
                {renderStatusBadge(selectedRoom.status)}
              </div>
            </div>

            {/* Botones circulares alrededor */}
            {selectedRoom.status === "LIBRE" && (
              <>
                {/* Iniciar estancia (arriba) */}
                <div className="absolute top-5 left-1/2 -translate-x-1/2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-blue-500/80"
                    title="Iniciar estancia"
                    onClick={() => {
                      setShowActionsModal(false);
                      setShowStartStayModal(true);
                    }}
                    disabled={actionLoading || !selectedRoom.room_types}
                  >
                    <DoorOpen className="h-4 w-4" />
                  </Button>
                </div>
                {/* Bloquear (abajo) */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-amber-500/80"
                    title="Bloquear (mantenimiento)"
                    onClick={() => {
                      updateRoomStatus(
                        selectedRoom,
                        "BLOQUEADA",
                        `La habitación ${selectedRoom.number} fue bloqueada por mantenimiento`
                      );
                      setShowActionsModal(false);
                    }}
                    disabled={actionLoading}
                  >
                    <Lock className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {selectedRoom.status === "OCUPADA" && (
              <>
                {/* Cobrar / Check-out (arriba) */}
                <div className="absolute top-5 left-1/2 -translate-x-1/2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-emerald-500/80"
                    title="Cobrar / Check-out"
                    onClick={() => {
                      openCheckoutModal(selectedRoom);
                      setShowActionsModal(false);
                    }}
                    disabled={actionLoading}
                  >
                    <DollarSign className="h-4 w-4" />
                  </Button>
                </div>

                {/* Ver venta (derecha) */}
                <div className="absolute right-5 top-1/2 -translate-y-1/2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-cyan-500/80"
                    title="Ver venta / consumos"
                    onClick={() => {
                      const activeStay = (selectedRoom.room_stays || []).find(
                        (stay) => stay.status === "ACTIVA"
                      );

                      if (!activeStay) {
                        toast.error("No se encontró una estancia activa para esta habitación", {
                          description:
                            "Revisa la tabla room_stays: no hay registro ACTIVA vinculado a esta habitación.",
                        });
                        return;
                      }

                      router.push(`/sales/${activeStay.sales_order_id}`);
                    }}
                    disabled={actionLoading}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>

                {/* + Persona (izquierda) */}
                <div className="absolute left-5 top-1/2 -translate-y-1/2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-purple-500/80"
                    title="Agregar persona extra"
                    onClick={() => {
                      handleChangePeople(selectedRoom, 1);
                    }}
                    disabled={actionLoading}
                  >
                    +
                  </Button>
                </div>

                {/* + Hora extra (abajo) */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-pink-500/80"
                    title="Agregar 1 hora extra"
                    onClick={() => {
                      handleAddExtraHour(selectedRoom);
                    }}
                    disabled={actionLoading}
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {selectedRoom.status === "SUCIA" && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-emerald-500/80"
                  title="Marcar como limpia"
                  onClick={() => {
                    updateRoomStatus(
                      selectedRoom,
                      "LIBRE",
                      `La habitación ${selectedRoom.number} ha sido marcada como limpia`
                    );
                    setShowActionsModal(false);
                  }}
                  disabled={actionLoading}
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
            )}

            {selectedRoom.status === "BLOQUEADA" && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-blue-500/80"
                  title="Liberar habitación"
                  onClick={() => {
                    updateRoomStatus(
                      selectedRoom,
                      "LIBRE",
                      `La habitación ${selectedRoom.number} fue liberada`
                    );
                    setShowActionsModal(false);
                  }}
                  disabled={actionLoading}
                >
                  <DoorOpen className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Botón de cierre del dock */}
            <Button
              variant="outline"
              size="icon"
              className="absolute top-2 right-2 rounded-full border-white/50 bg-black/40 text-white/80 hover:bg-black/70 hover:text-white"
              onClick={closeActionsDock}
              disabled={actionLoading}
              title="Cerrar acciones"
            >
              ✕
            </Button>
          </div>
        </div>
      )}
      {reminderAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-center">
              {reminderAlert.level === "5"
                ? "Habitación a punto de vencer"
                : "Habitación próxima a vencer"}
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              La habitación <span className="font-semibold">{reminderAlert.roomNumber}</span>{" "}
              está por terminar su tiempo.
              <br />
              Restante: {reminderAlert.minutes} minutos.
            </p>
            <div className="flex justify-center pt-2">
              <Button onClick={() => setReminderAlert(null)}>Aceptar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

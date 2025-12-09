"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { RoomCard } from "@/components/sales/room-card";
import { RoomInfoPopover } from "@/components/sales/room-info-popover";
import { RoomActionsWheel } from "@/components/sales/room-actions-wheel";
import { RoomStartStayModal } from "@/components/sales/room-start-stay-modal";
import { RoomCheckoutModal } from "@/components/sales/room-checkout-modal";
import { RoomReminderAlert } from "@/components/sales/room-reminder-alert";
import {
  Room,
  RoomType,
  STATUS_CONFIG,
  ROOM_STATUS_BG,
  ROOM_STATUS_ACCENT,
} from "@/components/sales/room-types";
import { useRoomActions, getActiveStay } from "@/hooks/use-room-actions";
import { toast } from "sonner";

export function RoomsBoard() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [startStayLoading, setStartStayLoading] = useState(false);

  // Función para recargar habitaciones
  const fetchRooms = useCallback(async () => {
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
  }, []);

  // Hook de acciones de habitación
  const {
    actionLoading,
    handleChangePeople,
    handleAddExtraHour,
    updateRoomStatus,
    prepareCheckout,
    processCheckout,
  } = useRoomActions(fetchRooms);

  // Abrir modal de checkout usando el hook
  const openCheckoutModal = async (room: Room) => {
    const info = await prepareCheckout(room);
    if (info) {
      setCheckoutInfo(info);
      setCheckoutAmount(info.remainingAmount);
      setSelectedRoom(room);
      setShowCheckoutModal(true);
    }
  };

  // Cerrar modal de checkout
  const handleCloseCheckoutModal = () => {
    if (actionLoading) return;
    setShowCheckoutModal(false);
    setSelectedRoom(null);
    setCheckoutInfo(null);
    setCheckoutAmount(0);
  };

  // Procesar checkout usando el hook
  const handleCheckout = async () => {
    if (!checkoutInfo || !selectedRoom) return;
    const success = await processCheckout(selectedRoom, checkoutInfo, checkoutAmount);
    if (success) {
      setShowCheckoutModal(false);
      setSelectedRoom(null);
      setCheckoutInfo(null);
      setCheckoutAmount(0);
    }
  };

  // Cargar habitaciones al montar
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

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

  // handleAddExtraHour viene del hook useRoomActions

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

    setStartStayLoading(true);
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
      setStartStayLoading(false);
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
              return (
                <RoomCard
                  key={room.id}
                  id={room.id}
                  number={room.number}
                  status={status}
                  bgClass={ROOM_STATUS_BG[status] || "bg-slate-900/80"}
                  accentClass={ROOM_STATUS_ACCENT[status] || ""}
                  statusBadge={renderStatusBadge(status)}
                  onInfo={() => {
                    setSelectedRoom(room);
                    setShowInfoModal(true);
                  }}
                  onActions={() => openActionsDock(room)}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
      <RoomStartStayModal
        isOpen={showStartStayModal && !!selectedRoom && !!selectedRoom.room_types}
        roomNumber={selectedRoom?.number || ""}
        roomType={selectedRoom?.room_types || { id: "", name: "" }}
        expectedCheckout={selectedRoom?.room_types ? calculateExpectedCheckout(selectedRoom.room_types) : new Date()}
        actionLoading={startStayLoading || actionLoading}
        onClose={handleCloseModal}
        onConfirm={handleStartStay}
      />
      <RoomInfoPopover
        room={selectedRoom}
        isOpen={showInfoModal && !!selectedRoom}
        onClose={() => setShowInfoModal(false)}
        getActiveStay={getActiveStay}
        getRemainingTimeLabel={getRemainingTimeLabel}
        getExtraHoursLabel={getExtraHoursLabel}
      />
      <RoomCheckoutModal
        isOpen={showCheckoutModal && !!selectedRoom && !!checkoutInfo}
        roomNumber={selectedRoom?.number || ""}
        roomTypeName={selectedRoom?.room_types?.name || ""}
        remainingAmount={checkoutInfo?.remainingAmount || 0}
        checkoutAmount={checkoutAmount}
        actionLoading={actionLoading}
        onAmountChange={setCheckoutAmount}
        onClose={handleCloseCheckoutModal}
        onConfirm={handleCheckout}
      />
      <RoomActionsWheel
        room={selectedRoom}
        isOpen={showActionsModal && !!selectedRoom}
        isVisible={actionsDockVisible}
        actionLoading={actionLoading}
        statusBadge={selectedRoom ? renderStatusBadge(selectedRoom.status) : null}
        onClose={closeActionsDock}
        onStartStay={() => {
          setShowActionsModal(false);
          setShowStartStayModal(true);
        }}
        onCheckout={() => {
          if (selectedRoom) {
            openCheckoutModal(selectedRoom);
            setShowActionsModal(false);
          }
        }}
        onViewSale={() => {
          if (!selectedRoom) return;
          const activeStay = getActiveStay(selectedRoom);
          if (!activeStay) {
            toast.error("No se encontró una estancia activa para esta habitación");
            return;
          }
          router.push(`/sales/${activeStay.sales_order_id}`);
        }}
        onAddPerson={() => {
          if (selectedRoom) handleChangePeople(selectedRoom, 1);
        }}
        onAddHour={() => {
          if (selectedRoom) handleAddExtraHour(selectedRoom);
        }}
        onMarkClean={() => {
          if (selectedRoom) {
            updateRoomStatus(
              selectedRoom,
              "LIBRE",
              `La habitación ${selectedRoom.number} ha sido marcada como limpia`
            );
            setShowActionsModal(false);
          }
        }}
        onBlock={() => {
          if (selectedRoom) {
            updateRoomStatus(
              selectedRoom,
              "BLOQUEADA",
              `La habitación ${selectedRoom.number} fue bloqueada por mantenimiento`
            );
            setShowActionsModal(false);
          }
        }}
        onUnblock={() => {
          if (selectedRoom) {
            updateRoomStatus(
              selectedRoom,
              "LIBRE",
              `La habitación ${selectedRoom.number} fue liberada`
            );
            setShowActionsModal(false);
          }
        }}
      />
      <RoomReminderAlert
        isOpen={!!reminderAlert}
        roomNumber={reminderAlert?.roomNumber || ""}
        minutes={reminderAlert?.minutes || 0}
        level={reminderAlert?.level || "20"}
        onClose={() => setReminderAlert(null)}
      />
    </div>
  );
}

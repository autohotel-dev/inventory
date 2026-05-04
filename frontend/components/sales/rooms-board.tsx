"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

import { Room, STATUS_CONFIG } from "@/components/sales/room-types";
import { RoomMetricsBanner } from "@/components/sales/rooms/room-metrics-banner";
import { RoomCardGrid } from "@/components/sales/rooms/room-card-grid";
import { useRoomsQuery } from "@/hooks/use-rooms-query";
import { useRoomActions, getCurrentEmployeeId } from "@/hooks/room-actions";
import { useSoundNotifications } from "@/hooks/use-sound-notifications";
import { useUserRole } from "@/hooks/use-user-role";
import { useSystemConfigRead } from "@/hooks/use-system-config";
import { useSensors } from "@/hooks/use-sensors";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { GlobalClock } from "@/components/ui/global-clock";
import { EXIT_TOLERANCE_MS } from "@/lib/constants/room-constants";
import { useTraining } from "@/contexts/training-context";
import { useRoomsTraining } from "@/hooks/training/use-rooms-training";
import { formatDateTime } from "@/components/rooms/modals/connected-start-stay-modal";

import { useRoomRealtime } from "@/hooks/rooms/use-room-realtime";
import { useCheckoutReminders } from "@/hooks/rooms/use-checkout-reminders";
import { useRoomTransitions } from "@/hooks/rooms/use-room-transitions";
import { useValetPaymentMonitor } from "@/hooks/valet/use-valet-payment-monitor";
import { useRoomModals } from "@/hooks/rooms/use-room-modals";
import { usePrintCenter } from "@/contexts/print-center-context";

// Dynamic imports para modales (reducción de bundle)
const ConnectedStartStayModal = dynamic(() => import("@/components/rooms/modals/connected-start-stay-modal").then(m => ({ default: m.ConnectedStartStayModal })), { ssr: false });
const ConnectedCheckoutModal = dynamic(() => import("@/components/rooms/modals/connected-checkout-modal").then(m => ({ default: m.ConnectedCheckoutModal })), { ssr: false });
const RoomDetailsModal = dynamic(() => import("@/components/sales/room-details-modal").then(m => ({ default: m.RoomDetailsModal })), { ssr: false });
const GranularPaymentModal = dynamic(() => import("@/components/sales/granular-payment-modal").then(m => ({ default: m.GranularPaymentModal })), { ssr: false });
const AddConsumptionModal = dynamic(() => import("@/components/sales/add-consumption-modal").then(m => ({ default: m.AddConsumptionModal })), { ssr: false });
const ConsumptionTrackingModal = dynamic(() => import("@/components/sales/consumption-tracking-modal").then(m => ({ default: m.ConsumptionTrackingModal })), { ssr: false });
const ConnectedQuickCheckinModal = dynamic(() => import("@/components/rooms/modals/connected-quick-checkin-modal").then(m => ({ default: m.ConnectedQuickCheckinModal })), { ssr: false });
const ConnectedEditVehicleModal = dynamic(() => import("@/components/rooms/modals/connected-edit-vehicle-modal").then(m => ({ default: m.ConnectedEditVehicleModal })), { ssr: false });
const ConnectedEditValetModal = dynamic(() => import("@/components/rooms/modals/connected-edit-valet-modal").then(m => ({ default: m.ConnectedEditValetModal })), { ssr: false });
const ConnectedChangeRoomModal = dynamic(() => import("@/components/rooms/modals/connected-change-room-modal").then(m => ({ default: m.ConnectedChangeRoomModal })), { ssr: false });
const ConnectedCancelStayModal = dynamic(() => import("@/components/rooms/modals/connected-cancel-stay-modal").then(m => ({ default: m.ConnectedCancelStayModal })), { ssr: false });
const ConnectedManagePeopleModal = dynamic(() => import("@/components/rooms/modals/connected-manage-people-modal").then(m => ({ default: m.ConnectedManagePeopleModal })), { ssr: false });
const ConnectedStatusNoteModal = dynamic(() => import("@/components/rooms/modals/connected-status-note-modal").then(m => ({ default: m.ConnectedStatusNoteModal })), { ssr: false });
const RoomHourManagementModal = dynamic(() => import("@/components/sales/room-hour-management-modal").then(m => ({ default: m.RoomHourManagementModal })), { ssr: false });
const AddDamageChargeModal = dynamic(() => import("@/components/sales/add-damage-charge-modal").then(m => ({ default: m.AddDamageChargeModal })), { ssr: false });
const GuestPortalQRModal = dynamic(() => import("@/components/sales/guest-portal-qr-modal").then(m => ({ default: m.GuestPortalQRModal })), { ssr: false });
const ValetDashboard = dynamic(() => import("@/components/valet/valet-dashboard").then(m => ({ default: m.ValetDashboard })), { ssr: false });
const RoomInfoPopover = dynamic(() => import("@/components/sales/room-info-popover").then(m => ({ default: m.RoomInfoPopover })), { ssr: false });
const RoomActionsWheel = dynamic(() => import("@/components/sales/room-actions-wheel").then(m => ({ default: m.RoomActionsWheel })), { ssr: false });
const RoomReminderAlert = dynamic(() => import("@/components/sales/room-reminder-alert").then(m => ({ default: m.RoomReminderAlert })), { ssr: false });
const AssignAssetModal = dynamic(() => import("@/components/rooms/modals/assign-asset-modal").then(m => ({ default: m.AssignAssetModal })), { ssr: false });
import { AdminBoardControls } from "@/components/sales/admin-board-controls";
import { notifyActiveValets } from "@/lib/services/valet-notification-service";

// Wrapper component para manejar la lógica de rol sin violar hooks rules
function RoomsBoardWrapper() {
  const { isValet, employeeId, isLoading: roleLoading } = useUserRole();

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isValet && employeeId) {
    return <ValetDashboard employeeId={employeeId} />;
  }

  return <RoomsBoardInternal />;
}

// Componente principal sin lógica condicional de hooks
function RoomsBoardInternal() {
  const router = useRouter();
  const supabase = createClient();
  const { rooms, isLoading: loading, refreshRooms: fetchRooms } = useRoomsQuery();
  const modals = useRoomModals();
  const { openPrintCenter } = usePrintCenter();
  const { isValet, employeeId } = useUserRole();

  // Notificaciones de sonido
  const { playError, playAlert } = useSoundNotifications(
    "receptionist",
    rooms.map((r) => ({ id: r.id, number: r.number }))
  );
  const [trackingFilter] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [assignRemoteRoom, setAssignRemoteRoom] = useState<Room | null>(null);
  const [plateSearch, setPlateSearch] = useState("");

  // Sensores y Realtime
  const { sensors } = useSensors();
  const prevSensorsRef = useRef<Map<string, boolean>>(new Map());

  // Lógicas Extraídas (Hooks)
  useRoomRealtime(fetchRooms, playAlert);
  useRoomTransitions(rooms, fetchRooms);
  const { reminderAlert, dismissReminder } = useCheckoutReminders(rooms, playAlert);
  const { hasPendingValetPayment } = useValetPaymentMonitor(modals.selectedRoom, modals.isOpen("actions"));

  // Sincronizar modales abiertos con datos frescos de rooms
  // (ej: cochero confirma salida → checkout_valet_employee_id se actualiza en tiempo real)
  useEffect(() => {
    if (rooms.length > 0) {
      modals.syncSelectedRoom(rooms);
    }
  }, [rooms]);

  const authRedirectedRef = useRef(false);
  const { activeModule, currentStepIndex, currentMode } = useTraining();

  const forceRelogin = useCallback(() => {
    if (authRedirectedRef.current) return;
    authRedirectedRef.current = true;
    toast.error("Sesión expirada", {
      description: "Por seguridad, vuelve a iniciar sesión.",
    });
    router.push("/auth/login");
  }, [router]);

  const ensureAuthenticated = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      forceRelogin();
      return false;
    }
    return true;
  }, [forceRelogin, supabase.auth]);

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      const ok = await ensureAuthenticated();
      if (!ok) return;
      if (!isMounted) return;
      authRedirectedRef.current = false;
    };

    check();

    const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!session) forceRelogin();
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [ensureAuthenticated, forceRelogin, supabase.auth]);

  // Detectar cambios en sensores para alertas
  useEffect(() => {
    // Si no hay sensores, no hacer nada
    if (sensors.length === 0) return;

    sensors.forEach((sensor) => {
      const wasOpen = prevSensorsRef.current.get(sensor.id);

      // Primera vez que vemos este sensor: solo inicializar, no alertar
      if (wasOpen === undefined) {
        prevSensorsRef.current.set(sensor.id, sensor.is_open);
        return;
      }

      // Si cambió de cerrado a abierto -> ALERTA
      if (sensor.is_open && wasOpen === false) {
        const room = rooms.find((r) => r.id === sensor.room_id);
        const roomNumber = room ? room.number : "Desconocida";

        console.log(`[Sensor] ¡Puerta abierta! Habitación ${roomNumber}`);

        toast.error(`¡Puerta Abierta! Habitación ${roomNumber}`, {
          duration: 8000,
          description: "La puerta ha sido abierta.",
        });

        // Usar sonido centralizado
        playError();
      }

      // Actualizar ref con estado actual
      prevSensorsRef.current.set(sensor.id, sensor.is_open);
    });
  }, [sensors, rooms, playError]);

  // Actualizar selectedRoom cuando rooms cambie (después de fetchRooms)
  useEffect(() => {
    if (modals.selectedRoom && rooms.length > 0) {
      const updatedRoom = rooms.find(r => r.id === modals.selectedRoom?.id);
      if (updatedRoom) {
        modals.setSelectedRoom(updatedRoom);
      }
    }
  }, [rooms, modals.selectedRoom, modals.setSelectedRoom]);







  // Hook de acciones de habitación
  const {
    actionLoading,
    handleRemovePerson,
    handlePersonLeftReturning,
    // handleAddExtraHour removida - usar handleAddCustomHours
    handleAddCustomHours,
    handleRenewRoom,
    handleAdd4HourPromo,
    updateRoomStatus,
    requestVehicle,
    handleAddDamageCharge,
    handleAuthorizeValetCheckout,
    handleCancelValetCheckout,
    handleCancelPendingCharge,
    handleCancelItem,
  } = useRoomActions(async () => await fetchRooms(true));





  // Manejar notificación de salida (Valet)
  const handleNotifyCheckout = async () => {
    if (!modals.selectedRoom || !isValet) return;

    // Obtener estancia activa
    const activeStay = getActiveStay(modals.selectedRoom);
    if (!activeStay) {
      toast.error("No hay estancia activa");
      return;
    }

    try {
      const currentEmployeeId = await getCurrentEmployeeId(supabase);
      if (!currentEmployeeId) {
        toast.error("No se pudo identificar al empleado");
        return;
      }

      const { error } = await supabase
        .from("room_stays")
        .update({
          valet_checkout_requested_at: new Date().toISOString(),
          valet_employee_id: currentEmployeeId // Asegurar que el valet que notifica se asigne si no lo estaba
        })
        .eq("id", activeStay.id);

      if (error) throw error;

      toast.success("Salida notificada a recepción", {
        description: `Habitación ${modals.selectedRoom.number}`
      });
      modals.closeModal("actions");
      fetchRooms(true);
    } catch (error) {
      console.error("Error notifying checkout:", error);
      toast.error("Error al notificar salida");
    }
  };

  // Procesar pago de extras (sin checkout) removido - usar pago granular

  // Verificar si una habitación tiene cargos extra pendientes
  const hasExtraCharges = (room: Room): boolean => {
    const activeStay = getActiveStay(room);
    if (!activeStay?.sales_orders) return false;
    return (activeStay.sales_orders.remaining_amount || 0) > 0;
  };

  useEffect(() => {
    const handleReconnect = () => {
      console.log("Realtime reconectado, refrescando rooms-board...");
      fetchRooms(true);
    };

    window.addEventListener("supabase-reconnect", handleReconnect);
    return () => {
      window.removeEventListener("supabase-reconnect", handleReconnect);
    };
  }, [fetchRooms]);



  const getActiveStay = (room: Room) => {
    return (room.room_stays || []).find((stay) => stay.status === "ACTIVA") || null;
  };

  const systemConfig = useSystemConfigRead();
  const MAX_PENDING_QUICK_CHECKINS = systemConfig.maxPendingQuickCheckins;

  const getPendingPaymentBacklogCount = () => {
    return rooms.reduce((count, room) => {
      if (room.status !== "OCUPADA") return count;
      const activeStay = getActiveStay(room);
      const remaining = activeStay?.sales_orders?.remaining_amount ?? 0;
      return remaining > 0 ? count + 1 : count;
    }, 0);
  };

  const getRemainingTimeLabel = useCallback((room: Room) => {
    const activeStay = getActiveStay(room);

    if (!activeStay || !activeStay.expected_check_out_at) return null;

    const now = new Date();
    const checkout = new Date(activeStay.expected_check_out_at);
    const diffMs = now.getTime() - checkout.getTime();

    // TOLERANCIA DE SALIDA: Si el tiempo terminó pero pasaron <= 30 min y sigue ocupada
    if (diffMs > 0 && diffMs <= EXIT_TOLERANCE_MS) {
      const remainingGraceMs = EXIT_TOLERANCE_MS - diffMs;
      const minutesLeft = Math.ceil(remainingGraceMs / 60000);
      return {
        eta: "TOLERANCIA",
        remaining: `${minutesLeft}m gracia`,
        minutesToCheckout: 0,
        isSaliendo: true
      };
    }

    const diffMsFromNow = checkout.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMsFromNow / 60000);
    const absMinutes = Math.abs(diffMinutes);

    // Si estamos en tiempo extra, calcular cuánto falta para la SIGUIENTE hora
    if (diffMinutes < 0) {
      const minutesInOvertime = Math.abs(diffMinutes);
      const minutesIntoCurrentHour = minutesInOvertime % 60;
      const minutesToNextHour = 60 - minutesIntoCurrentHour;

      return {
        eta: formatDateTime(checkout),
        remaining: `-${minutesToNextHour}m`, // Indica que faltan X min para el siguiente cargo
        minutesToCheckout: diffMinutes,
        isExtra: true
      };
    }

    // Tiempo normal (aún no vence)
    const days = Math.floor(absMinutes / (60 * 24));
    const hours = Math.floor((absMinutes % (60 * 24)) / 60);
    const minutes = absMinutes % 60;

    const labelParts = [] as string[];
    if (days > 0) labelParts.push(`${days}d`);
    if (hours > 0) labelParts.push(`${hours}h`);
    labelParts.push(`${minutes}m`);

    return {
      eta: formatDateTime(checkout),
      remaining: labelParts.join(" "),
      minutesToCheckout: diffMinutes,
    };
  }, []);

  const getExtraHoursLabel = useCallback((room: Room) => {
    const activeStay = getActiveStay(room);
    if (!activeStay || !activeStay.expected_check_out_at) return 0;

    const expected = new Date(activeStay.expected_check_out_at);
    const now = new Date();
    const diffMs = now.getTime() - expected.getTime();

    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (60 * 60 * 1000));
  }, []);

  const openConsumptionModalCb = useCallback((room: Room) => {
    const stay = getActiveStay(room);
    if (stay?.sales_order_id) modals.openConsumptionModal(room, stay.sales_order_id);
    else toast.error("No se encontró una orden activa");
  }, [modals]);

  const setShowInfoModalCb = useCallback((show: boolean) => {
    show ? modals.openModal("info") : modals.closeModal("info");
  }, [modals]);

  const setShowTrackingModalCb = useCallback((show: boolean) => {
    show ? modals.openModal("tracking") : modals.closeModal("tracking");
  }, [modals]);

  const renderStatusBadge = useCallback((status: string, isSaliendo: boolean = false) => {
    let config = STATUS_CONFIG[status] || {
      label: status,
      color: "bg-muted text-muted-foreground border-border",
    };

    if (isSaliendo) {
      config = {
        label: "Saliendo",
        shortLabel: "Sal.",
        color: "bg-orange-950/50 text-orange-100 border-orange-400/40 animate-pulse",
      };
    }

    return (
      <Badge
        variant="outline"
        className={`text-[10px] sm:text-xs font-medium border px-1 ${config.color} truncate max-w-[70px] sm:max-w-none`}
      >
        {config.shortLabel ? (
          <>
            <span className="sm:hidden">{config.shortLabel}</span>
            <span className="hidden sm:inline">{config.label}</span>
          </>
        ) : (
          config.label
        )}
      </Badge>
    );
  }, []);

  useRoomsTraining({
    activeModule, currentStepIndex, currentMode,
    rooms, modals, updateRoomStatus
  });

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
          <Button variant="outline" size="sm" onClick={() => fetchRooms()}>
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Tablero de Habitaciones</h1>
          <p className="text-muted-foreground text-sm hidden md:block">
            Vista general de todas las habitaciones.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto self-end sm:self-auto justify-between sm:justify-end">
          {/* Reloj móvil: visible a la izquierda en móvil, oculto en desktop */}
          <div className="sm:hidden flex-1">
            <GlobalClock />
          </div>

          <AdminBoardControls />

          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              setIsRefreshing(true);
              await fetchRooms(true);
              setTimeout(() => setIsRefreshing(false), 500);
            }}
            disabled={isRefreshing}
            className="text-muted-foreground hover:text-foreground transition-colors h-10 px-3 order-2 sm:order-1"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            <span className="hidden sm:inline">{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
            <span className="sm:hidden">{isRefreshing ? '...' : 'Sync'}</span>
          </Button>

          {/* Reloj desktop: visible a la derecha en desktop, oculto en móvil */}
          <div className="hidden sm:block order-1 sm:order-2">
            <GlobalClock />
          </div>
        </div>
      </div>

      <RoomMetricsBanner rooms={rooms} />

      {/* ── Búsqueda por Placa ──────────────────────────────── */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-sm">🚗</span>
            <input
              type="text"
              placeholder="Buscar placa del vehículo..."
              value={plateSearch}
              onChange={(e) => setPlateSearch(e.target.value.toUpperCase())}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all"
            />
            {plateSearch && (
              <button
                onClick={() => setPlateSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground text-xs"
              >✕</button>
            )}
          </div>
        </div>
        {plateSearch.length >= 2 && (() => {
          const matches = rooms.filter((r) => {
            const stay = (r.room_stays || []).find((s: any) => s.status === "ACTIVA");
            if (!stay?.vehicle_plate) return false;
            return stay.vehicle_plate.toUpperCase().includes(plateSearch);
          });
          if (matches.length === 0) {
            return (
              <div className="mt-2 px-3 py-2 rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
                No se encontró ningún vehículo con placa &quot;{plateSearch}&quot;
              </div>
            );
          }
          return (
            <div className="mt-2 space-y-1.5">
              {matches.map((room) => {
                const stay = (room.room_stays || []).find((s: any) => s.status === "ACTIVA")!;
                return (
                  <button
                    key={room.id}
                    onClick={() => modals.openActionsDock(room)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-accent/50 hover:border-blue-500/30 transition-all group text-left"
                  >
                    <span className="text-xl">🚗</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">Habitación {room.number}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {stay.vehicle_plate}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/60 truncate">
                        {[stay.vehicle_brand, stay.vehicle_model].filter(Boolean).join(" ") || "Sin marca/modelo"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground/30 group-hover:text-foreground/50 transition-colors">
                      Abrir →
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Grid único de habitaciones */}
      <Card>
        <CardContent className="pt-4">
          <RoomCardGrid
            rooms={rooms}
            sensors={sensors}
            highlightedRoomIds={plateSearch.length >= 2 ? new Set(
              rooms.filter((r) => {
                const stay = (r.room_stays || []).find((s: any) => s.status === "ACTIVA");
                return stay?.vehicle_plate?.toUpperCase().includes(plateSearch);
              }).map(r => r.id)
            ) : undefined}
            getRemainingTimeLabel={getRemainingTimeLabel}
            renderStatusBadge={renderStatusBadge}
            openActionsDock={modals.openActionsDock}
            openConsumptionModal={openConsumptionModalCb}
            setSelectedRoom={modals.setSelectedRoom}
            setShowInfoModal={setShowInfoModalCb}
            setShowTrackingModal={setShowTrackingModalCb}
            onAssignRemote={(room) => setAssignRemoteRoom(room)}
            onCancelStay={(room) => {
              modals.setSelectedRoom(room);
              modals.openModal("cancelStay");
            }}
          />
        </CardContent>
      </Card>
      
      <AssignAssetModal 
        isOpen={!!assignRemoteRoom}
        onClose={() => setAssignRemoteRoom(null)}
        room={assignRemoteRoom}
        assetType="TV_REMOTE"
        onSuccess={() => fetchRooms(true)}
      />

      <ConnectedStartStayModal
        isOpen={modals.isOpen("startStay") && !!modals.selectedRoom}
        room={modals.selectedRoom}
        onClose={() => modals.closeModal("startStay")}
        onSuccess={() => fetchRooms(true)}
      />
      <RoomInfoPopover
        room={modals.selectedRoom}
        isOpen={modals.isOpen("info") && !!modals.selectedRoom}
        onClose={() => modals.closeModal("info")}
        getActiveStay={getActiveStay}
        getRemainingTimeLabel={getRemainingTimeLabel}
        getExtraHoursLabel={getExtraHoursLabel}
      />
      <ConnectedCheckoutModal
        isOpen={modals.isOpen("checkout") && !!modals.selectedRoom}
        room={modals.selectedRoom}
        onClose={() => modals.closeModal("checkout")}
        onSuccess={() => fetchRooms(true)}
      />
      <RoomActionsWheel
        room={modals.selectedRoom}
        isOpen={modals.isOpen("actions")}
        isVisible={modals.actionsDockVisible}
        actionLoading={actionLoading}
        hasPendingValetPayment={hasPendingValetPayment}
        statusBadge={modals.selectedRoom ? renderStatusBadge(modals.selectedRoom.status) : null}
        hasExtraCharges={modals.selectedRoom ? hasExtraCharges(modals.selectedRoom) : false}
        isHotelRoom={modals.selectedRoom?.room_types?.is_hotel === true}
        onClose={() => modals.closeActionsDock()}
        onStartStay={() => {
          modals.closeModal("actions");
          modals.openModal("startStay");
        }}
        onCheckout={() => {
          if (modals.selectedRoom) {
            modals.openModal("checkout");
            modals.closeModal("actions");
          }
        }}
        onViewSale={() => {
          if (!modals.selectedRoom) return;
          const activeStay = getActiveStay(modals.selectedRoom);
          if (!activeStay) {
            toast.error("No se encontró una estancia activa para esta habitación");
            return;
          }
          router.push(`/sales/${activeStay.sales_order_id}`);
        }}
        onViewDetails={() => {
          if (modals.selectedRoom) {
            modals.closeModal("actions");
            modals.openModal("details");
          }
        }}
        onGranularPayment={() => {
          if (modals.selectedRoom) {
            const activeStay = getActiveStay(modals.selectedRoom);
            if (activeStay?.sales_order_id) {
               modals.openGranularPaymentModal(modals.selectedRoom, activeStay.sales_order_id);
            }
            modals.closeModal("actions");
          }
        }}
        onAddPerson={() => {
          if (modals.selectedRoom) {
            modals.openModal("managePeople");
            modals.closeModal("actions");
          }
        }}
        onRemovePerson={() => {
          if (modals.selectedRoom) handleRemovePerson(modals.selectedRoom);
        }}
        onPersonLeftReturning={() => {
          if (modals.selectedRoom) handlePersonLeftReturning(modals.selectedRoom);
        }}
        onAddHour={() => {
          modals.closeModal("actions");
          modals.openModal("hourManagement");
        }}
        onMarkClean={() => modals.selectedRoom && updateRoomStatus(modals.selectedRoom, "LIBRE", "Habitación limpia")}
        onBlock={() => {
          const room = modals.selectedRoom;
          modals.closeActionsDock();
          setTimeout(() => {
            if (room) modals.openStatusNoteModal(room, "BLOCK");
          }, 200);
        }}
        onUnblock={() => modals.selectedRoom && updateRoomStatus(modals.selectedRoom, "LIBRE", "Habitación desbloqueada")}
        onMarkDirty={() => {
          const room = modals.selectedRoom;
          modals.closeActionsDock();
          setTimeout(() => {
            if (room) modals.openStatusNoteModal(room, "DIRTY");
          }, 200);
        }}
        onQuickCheckin={() => {
          const pendingBacklog = getPendingPaymentBacklogCount();
          if (pendingBacklog >= MAX_PENDING_QUICK_CHECKINS) {
            toast.error("Entrada Rápida temporalmente bloqueada", {
              description: `Hay ${pendingBacklog} habitaciones con cobro pendiente. Cobra alguna para poder registrar nuevas entradas.`,
            });
            modals.closeActionsDock();
            return;
          }

          modals.closeModal("actions");
          modals.openModal("quickCheckin");
        }}
        onEditVehicle={() => {
          modals.closeModal("actions");
          modals.openModal("editVehicle");
        }}
        onEditValet={() => {
          modals.closeModal("actions");
          modals.openModal("editValet");
        }}
        onChangeRoom={() => {
          modals.closeModal("actions");
          modals.openModal("changeRoom");
        }}
        onCancelStay={() => {
          modals.closeModal("actions");
          modals.openModal("cancelStay");
        }}
        onManagePeople={() => {
          modals.closeModal("actions");
          modals.openModal("managePeople");
        }}
        onShowGuestPortal={() => {
          modals.openModal("guestPortalQR");
        }}
        onRequestVehicle={async () => {
          if (modals.selectedRoom) {
            const activeStay = getActiveStay(modals.selectedRoom);
            if (activeStay) {
              await requestVehicle(activeStay.id);
              modals.closeModal("actions");
            }
          }
        }}
        onAddDamageCharge={() => {
          if (modals.selectedRoom) modals.openModal("damageCharge");
        }}
        onNotifyCheckout={handleNotifyCheckout}

        isValet={isValet}
        hasValetAssigned={modals.selectedRoom ? !!getActiveStay(modals.selectedRoom)?.valet_employee_id : false}
        hasVehicleRegistered={modals.selectedRoom ? !!getActiveStay(modals.selectedRoom)?.vehicle_plate : false}
        hasValetCheckoutRequest={modals.selectedRoom ? (!!getActiveStay(modals.selectedRoom)?.valet_checkout_requested_at && !getActiveStay(modals.selectedRoom)?.vehicle_requested_at) : false}
        onAuthorizeValetCheckout={async () => {
          if (modals.selectedRoom) {
            await handleAuthorizeValetCheckout(modals.selectedRoom);
            modals.closeModal("actions");
          }
        }}
        onCancelValetCheckout={async () => {
          if (modals.selectedRoom) {
            await handleCancelValetCheckout(modals.selectedRoom);
            modals.closeModal("actions");
          }
        }}
        onOpenPrintCenter={() => {
          modals.closeActionsDock();
          openPrintCenter("recent");
        }}
      />
      <RoomReminderAlert
        isOpen={!!reminderAlert}
        roomNumber={reminderAlert?.roomNumber || ""}
        minutes={reminderAlert?.minutes || 0}
        level={reminderAlert?.level || "20"}
        onClose={dismissReminder}
      />
      <RoomDetailsModal
        isOpen={modals.isOpen("details") && !!modals.selectedRoom}
        room={modals.selectedRoom}
        activeStay={modals.selectedRoom ? getActiveStay(modals.selectedRoom) : null}
        employeeId={employeeId}
        onCancelCharge={handleCancelPendingCharge}
        onCancelItem={handleCancelItem}
        onClose={() => {
          modals.closeModal("details");
        }}
      />
      <ConsumptionTrackingModal
        isOpen={modals.isOpen("tracking") && !!modals.selectedRoom}
        salesOrderId={modals.selectedRoom ? getActiveStay(modals.selectedRoom)?.sales_order_id || null : null}
        roomNumber={modals.selectedRoom?.number || ""}
        receptionistId={employeeId || ''}
        defaultFilter={trackingFilter}
        onClose={() => modals.closeModal("tracking")}
        onRefresh={() => fetchRooms(true)}
      />
      <GranularPaymentModal
        isOpen={modals.isOpen("granularPayment") && !!modals.granularPaymentOrderId}
        salesOrderId={modals.granularPaymentOrderId || ""}
        roomNumber={modals.selectedRoom?.number}
        onClose={() => { modals.closeModal("granularPayment"); modals.setGranularPaymentOrderId(null); }}
        onComplete={() => { modals.closeModal("granularPayment"); modals.setGranularPaymentOrderId(null); fetchRooms(true); }}
      />
      <AddConsumptionModal
        isOpen={modals.isOpen("consumption") && !!modals.consumptionOrderId}
        salesOrderId={modals.consumptionOrderId || ""}
        roomNumber={modals.selectedRoom?.number}
        onClose={() => { modals.closeModal("consumption"); modals.setConsumptionOrderId(null); }}
        onComplete={() => { modals.closeModal("consumption"); modals.setConsumptionOrderId(null); fetchRooms(true); }}
      />
      <ConnectedQuickCheckinModal
        isOpen={modals.isOpen("quickCheckin") && !!modals.selectedRoom}
        selectedRoom={modals.selectedRoom}
        pendingBacklogCount={getPendingPaymentBacklogCount()}
        onClose={() => {
          modals.closeModal("quickCheckin");
          modals.setSelectedRoom(null);
        }}
        onSuccess={() => fetchRooms(true)}
      />
      <ConnectedEditVehicleModal
        isOpen={modals.isOpen("editVehicle")}
        room={modals.selectedRoom}
        onClose={() => modals.closeModal("editVehicle")}
        onSuccess={() => fetchRooms(true)}
      />
      <ConnectedEditValetModal
        isOpen={modals.isOpen("editValet")}
        room={modals.selectedRoom}
        onClose={() => modals.closeModal("editValet")}
        onSuccess={() => fetchRooms(true)}
      />
      <ConnectedChangeRoomModal
        isOpen={modals.isOpen("changeRoom")}
        room={modals.selectedRoom}
        rooms={rooms}
        onClose={() => modals.closeModal("changeRoom")}
        onSuccess={() => fetchRooms(true)}
      />
      <ConnectedCancelStayModal
        isOpen={modals.isOpen("cancelStay")}
        room={modals.selectedRoom}
        onClose={() => modals.closeModal("cancelStay")}
        onSuccess={() => fetchRooms(true)}
      />
      <ConnectedManagePeopleModal
        isOpen={modals.isOpen("managePeople")}
        room={modals.selectedRoom}
        onClose={() => modals.closeModal("managePeople")}
        onSuccess={() => fetchRooms(true)}
      />

      <ConnectedStatusNoteModal
        isOpen={modals.isOpen("statusNote")}
        selectedRoom={modals.selectedRoom}
        actionType={modals.statusNoteAction}
        onClose={() => {
          modals.closeModal("statusNote");
          modals.setStatusNoteAction(null);
          modals.setSelectedRoom(null);
        }}
        updateRoomStatus={updateRoomStatus}
      />

      <RoomHourManagementModal
        isOpen={modals.isOpen("hourManagement") && !!modals.selectedRoom}
        room={modals.selectedRoom}
        actionLoading={actionLoading}
        onClose={() => modals.closeModal("hourManagement")}
        onConfirmCustomHours={async (hours, isCourtesy, courtesyReason) => {
          if (modals.selectedRoom) {
            await handleAddCustomHours(modals.selectedRoom, hours, isCourtesy, courtesyReason);
            modals.closeModal("hourManagement");
            modals.closeModal("info"); // Cerrar para refrescar tiempo
          }
        }}
        onConfirmRenew={async () => {
          if (modals.selectedRoom) {
            await handleRenewRoom(modals.selectedRoom);
            modals.closeModal("hourManagement");
            modals.closeModal("info"); // Cerrar para refrescar tiempo
          }
        }}
        onConfirmPromo4H={async () => {
          if (modals.selectedRoom) {
            await handleAdd4HourPromo(modals.selectedRoom);
            modals.closeModal("hourManagement");
            modals.closeModal("info"); // Cerrar para refrescar tiempo
          }
        }}
      />

      <AddDamageChargeModal
        isOpen={modals.isOpen("damageCharge") && !!modals.selectedRoom}
        room={modals.selectedRoom || null}
        actionLoading={actionLoading}
        onClose={() => modals.closeModal("damageCharge")}
        onConfirm={async (amount, reason) => {
          if (modals.selectedRoom) {
            await handleAddDamageCharge(modals.selectedRoom, amount, reason);
            modals.closeModal("damageCharge");
          }
        }}
      />
      <GuestPortalQRModal
        isOpen={modals.isOpen("guestPortalQR") && !!modals.selectedRoom}
        onClose={() => modals.closeModal("guestPortalQR")}
        roomNumber={modals.selectedRoom?.number || ""}
        roomStayId={modals.selectedRoom ? (getActiveStay(modals.selectedRoom)?.id || "") : ""}
      />
    </div >
  );
}

// Export wrapper como componente principal
export { RoomsBoardWrapper as RoomsBoard };

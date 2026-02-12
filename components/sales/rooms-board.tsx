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
import { RoomCard } from "@/components/sales/room-card";
import { RoomInfoPopover } from "@/components/sales/room-info-popover";
import { RoomActionsWheel } from "@/components/sales/room-actions-wheel";
import { RoomReminderAlert } from "@/components/sales/room-reminder-alert";
import {
  Room,
  RoomType,
  STATUS_CONFIG,
  ROOM_STATUS_BG,
  ROOM_STATUS_ACCENT,
  PAYMENT_TERMINALS,
} from "@/components/sales/room-types";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { VehicleInfo } from "@/components/sales/room-start-stay-modal";
import { useThermalPrinter, ConsumptionTicketData } from "@/hooks/use-thermal-printer";
import { useRoomActions, isToleranceExpired, getToleranceRemainingMinutes, getActiveStay, generatePaymentReference, getCurrentShiftId } from "@/hooks/use-room-actions";
import { createServiceItem } from "@/lib/services/product-service";
import { useSoundNotifications } from "@/hooks/use-sound-notifications";
import { useUserRole } from "@/hooks/use-user-role";
import { useSystemConfigRead } from "@/hooks/use-system-config";
import { useSensors } from "@/hooks/use-sensors";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { GlobalClock } from "@/components/ui/global-clock";
import { EXIT_TOLERANCE_MS } from "@/lib/constants/room-constants";
import { useTraining } from "@/contexts/training-context";

// Dynamic imports para modales (reducción de bundle)
const RoomStartStayModal = dynamic(() => import("@/components/sales/room-start-stay-modal").then(m => ({ default: m.RoomStartStayModal })), { ssr: false });
const RoomCheckoutModal = dynamic(() => import("@/components/sales/room-checkout-modal").then(m => ({ default: m.RoomCheckoutModal })), { ssr: false });
const RoomPayExtraModal = dynamic(() => import("@/components/sales/room-pay-extra-modal").then(m => ({ default: m.RoomPayExtraModal })), { ssr: false });
const RoomDetailsModal = dynamic(() => import("@/components/sales/room-details-modal").then(m => ({ default: m.RoomDetailsModal })), { ssr: false });
const GranularPaymentModal = dynamic(() => import("@/components/sales/granular-payment-modal").then(m => ({ default: m.GranularPaymentModal })), { ssr: false });
const AddConsumptionModal = dynamic(() => import("@/components/sales/add-consumption-modal").then(m => ({ default: m.AddConsumptionModal })), { ssr: false });
const ConsumptionTrackingModal = dynamic(() => import("@/components/sales/consumption-tracking-modal").then(m => ({ default: m.ConsumptionTrackingModal })), { ssr: false });
const QuickCheckinModal = dynamic(() => import("@/components/sales/quick-checkin-modal").then(m => ({ default: m.QuickCheckinModal })), { ssr: false });
const EditVehicleModal = dynamic(() => import("@/components/sales/edit-vehicle-modal").then(m => ({ default: m.EditVehicleModal })), { ssr: false });
const EditValetModal = dynamic(() => import("@/components/sales/edit-valet-modal").then(m => ({ default: m.EditValetModal })), { ssr: false });
const ChangeRoomModal = dynamic(() => import("@/components/sales/change-room-modal").then(m => ({ default: m.ChangeRoomModal })), { ssr: false });
const CancelStayModal = dynamic(() => import("@/components/sales/cancel-stay-modal").then(m => ({ default: m.CancelStayModal })), { ssr: false });
const ManagePeopleModal = dynamic(() => import("@/components/sales/manage-people-modal").then(m => ({ default: m.ManagePeopleModal })), { ssr: false });
const RoomStatusNoteModal = dynamic(() => import("@/components/sales/room-status-note-modal").then(m => ({ default: m.RoomStatusNoteModal })), { ssr: false });
const RoomHourManagementModal = dynamic(() => import("@/components/sales/room-hour-management-modal").then(m => ({ default: m.RoomHourManagementModal })), { ssr: false });
const AddDamageChargeModal = dynamic(() => import("@/components/sales/add-damage-charge-modal").then(m => ({ default: m.AddDamageChargeModal })), { ssr: false });
const GuestPortalQRModal = dynamic(() => import("@/components/sales/guest-portal-qr-modal").then(m => ({ default: m.GuestPortalQRModal })), { ssr: false });



// Helper para obtener employee_id del usuario actual
const getCurrentEmployeeId = async (supabase: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    return employee?.id || null;
  } catch (err) {
    console.error("Error getting current employee id:", err);
    return null;
  }
};

import { notifyActiveValets } from "@/lib/services/valet-notification-service";

// FIX #4: Helper para notificar a valets después de un check-in
const notifyValetsOfNewEntry = async (supabase: any, roomNumber: string, roomId: string, stayId: string) => {
  await notifyActiveValets(
    supabase,
    '🚗 Nueva Entrada',
    `Nueva estancia en Habitación ${roomNumber}. Acepta la entrada para registrar vehículo.`,
    {
      type: 'NEW_ENTRY',
      room_id: roomId,
      room_number: roomNumber,
      stay_id: stayId
    }
  );
};



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
    const ValetDashboard = require("@/components/valet/valet-dashboard").ValetDashboard;
    return <ValetDashboard employeeId={employeeId} />;
  }

  return <RoomsBoardInternal />;
}

// Componente principal sin lógica condicional de hooks
function RoomsBoardInternal() {
  const router = useRouter();
  const supabase = createClient();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showStartStayModal, setShowStartStayModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutAmount, setCheckoutAmount] = useState<number>(0);
  const [checkoutInfo, setCheckoutInfo] = useState<{
    salesOrderId: string;
    remainingAmount: number;
    pendingItems?: { concept_type: string; total: number; count: number }[];
  } | null>(null);
  // Estados para pagar extras
  const [showPayExtraModal, setShowPayExtraModal] = useState(false);
  const [payExtraAmount, setPayExtraAmount] = useState<number>(0);
  const [payExtraInfo, setPayExtraInfo] = useState<{
    salesOrderId: string;
    extraAmount: number;
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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showGranularPaymentModal, setShowGranularPaymentModal] = useState(false);
  const [granularPaymentOrderId, setGranularPaymentOrderId] = useState<string | null>(null);
  const [showConsumptionModal, setShowConsumptionModal] = useState(false);
  const [consumptionOrderId, setConsumptionOrderId] = useState<string | null>(null);
  const [actionsDockVisible, setActionsDockVisible] = useState(false);
  const [startStayLoading, setStartStayLoading] = useState(false);
  const { isValet, employeeId } = useUserRole();

  // Notificaciones de sonido
  const { playSuccess, playError, playAlert } = useSoundNotifications(
    "receptionist",
    rooms.map((r) => ({ id: r.id, number: r.number }))
  );
  const [showQuickCheckinModal, setShowQuickCheckinModal] = useState(false);
  const [showEditVehicleModal, setShowEditVehicleModal] = useState(false);
  const [showEditValetModal, setShowEditValetModal] = useState(false);
  const [showChangeRoomModal, setShowChangeRoomModal] = useState(false);
  const [showCancelStayModal, setShowCancelStayModal] = useState(false);
  const [showManagePeopleModal, setShowManagePeopleModal] = useState(false);
  const [showStatusNoteModal, setShowStatusNoteModal] = useState(false);
  const [statusNoteAction, setStatusNoteAction] = useState<"BLOCK" | "DIRTY" | null>(null);
  const [showHourManagementModal, setShowHourManagementModal] = useState(false);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [showGuestPortalQRModal, setShowGuestPortalQRModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Estado para pagos de valet pendientes
  const [hasPendingValetPayment, setHasPendingValetPayment] = useState(false);

  // Verificar pagos de valet cuando se abre el modal
  useEffect(() => {
    if (showActionsModal && selectedRoom) {
      const activeStay = getActiveStay(selectedRoom);
      if (activeStay?.sales_order_id) {
        const checkValetPayments = async () => {
          // 1. Verificar pagos reportados en tabla payments
          // const { data } = await supabase... (original)
          const { data: paymentsData } = await supabase
            .from('payments')
            .select('id')
            .eq('sales_order_id', activeStay.sales_order_id)
            .eq('status', 'COBRADO_POR_VALET')
            .is('confirmed_at', null)
            .limit(1);

          if (paymentsData && paymentsData.length > 0) {
            setHasPendingValetPayment(true);
            return;
          }

          // 2. Verificar items entregados/verificados por cochero pero no pagados (ej. cambios de habitación)
          const { data: itemsData } = await supabase
            .from('sales_order_items')
            .select('id')
            .eq('sales_order_id', activeStay.sales_order_id)
            .eq('delivery_status', 'DELIVERED')
            .eq('is_paid', false)
            .limit(1);

          setHasPendingValetPayment(!!itemsData && itemsData.length > 0);
        };
        checkValetPayments();
      } else {
        setHasPendingValetPayment(false);
      }
    }
  }, [showActionsModal, selectedRoom]);

  // Sensores
  const { isPrinting, printConsumptionTickets } = useThermalPrinter();
  const { sensors } = useSensors();
  const prevSensorsRef = useRef<Map<string, boolean>>(new Map());
  const trainingStatusRoomIdRef = useRef<string | null>(null);
  const trainingStatusDirtyTriggeredRef = useRef(false);
  const trainingStatusBlockTriggeredRef = useRef(false);
  const trainingStatusCleanTriggeredRef = useRef(false);
  const trainingWheelRoomIdRef = useRef<string | null>(null);
  const trainingStatusCleanStepInitRef = useRef(false);
  const trainingStatusPrevStepIdRef = useRef<string | null>(null);
  const trainingStatusUpdateChainRef = useRef<Promise<void>>(Promise.resolve());
  const trainingStatusWasActiveRef = useRef(false);
  const trainingStatusEndCleanupRef = useRef(false);
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
    if (selectedRoom && rooms.length > 0) {
      const updatedRoom = rooms.find(r => r.id === selectedRoom.id);
      if (updatedRoom) {
        setSelectedRoom(updatedRoom);
      }
    }
  }, [rooms]);

  // Training: Auto-abrir la rueda de acciones y auto-ejecutar acciones en el módulo de check-in
  useEffect(() => {
    if (activeModule?.id !== 'room-checkin' || currentMode !== 'interactive') return;

    const activeStep = activeModule.steps[currentStepIndex];

    // Paso 2 (índice 1): Mostrar la rueda de acciones
    if (currentStepIndex === 1 && activeStep?.id === 'action-wheel') {
      if (rooms.length > 0 && !showActionsModal) {
        const freeRoom = rooms.find(r => r.status === 'LIBRE');
        if (freeRoom) {
          console.log('🎓 [Training] Auto-abriendo rueda de acciones para demostración');
          openActionsDock(freeRoom);
        }
      }
    }

    // Paso 3 (índice 2): Auto-abrir modal de check-in rápido
    if (currentStepIndex === 2 && activeStep?.id === 'check-in-rapido' && showActionsModal && !showQuickCheckinModal) {
      window.setTimeout(() => {
        console.log('🎓 [Training] Auto-abriendo modal de check-in rápido');
        setShowQuickCheckinModal(true);
        setShowActionsModal(false);
      }, 500);
    }
  }, [activeModule, currentStepIndex, currentMode, rooms, showActionsModal, showQuickCheckinModal]);

  // Training: Auto-abrir la rueda de acciones y modal de gestión de personas en el módulo de room-guests
  useEffect(() => {
    if (activeModule?.id !== 'room-guests' || currentMode !== 'interactive') return;
    const activeStep = activeModule.steps[currentStepIndex];

    // Paso 1 (índice 0): Solo habitación ocupada resaltada - cerrar todo
    if (currentStepIndex === 0 && activeStep?.id === 'select-occupied-room') {
      if (showActionsModal) {
        console.log('🎓 [Training] Cerrando rueda de acciones (navegación hacia atrás)');
        setShowActionsModal(false);
        setActionsDockVisible(false);
      }
      if (showManagePeopleModal) {
        console.log('🎓 [Training] Cerrando modal de gestión de personas (navegación hacia atrás)');
        setShowManagePeopleModal(false);
      }
    }

    // Paso 2 (índice 1): Mostrar la rueda de acciones para habitación ocupada
    if (currentStepIndex === 1 && activeStep?.id === 'action-wheel-occupied') {
      if (showManagePeopleModal) {
        console.log('🎓 [Training] Cerrando modal de personas y mostrando rueda (navegación hacia atrás)');
        setShowManagePeopleModal(false);
      }

      if (rooms.length > 0 && !showActionsModal) {
        const occupiedRoom = rooms.find(r => r.status === 'OCUPADA');
        if (occupiedRoom) {
          console.log('🎓 [Training] Auto-abriendo rueda de acciones para habitación ocupada');
          openActionsDock(occupiedRoom);
        }
      }
    }

    // Paso 3 (índice 2): Auto-abrir modal de gestión de personas
    if (currentStepIndex === 2 && activeStep?.id === 'manage-people') {
      if (showActionsModal && !showManagePeopleModal) {
        window.setTimeout(() => {
          console.log('🎓 [Training] Auto-abriendo modal de gestión de personas');
          setShowManagePeopleModal(true);
          setShowActionsModal(false);
        }, 500);
      } else if (!showManagePeopleModal && !showActionsModal) {
        setShowManagePeopleModal(true);
      }
    }

    // Paso 4 (índice 3): Auto-seleccionar "Entra una persona"
    if (currentStepIndex === 3 && activeStep?.id === 'add-person-option') {
      if (!showManagePeopleModal) setShowManagePeopleModal(true);

      window.setTimeout(() => {
        const addRadio = document.getElementById('tour-add-person-radio');
        if (addRadio) {
          console.log('🎓 [Training] Auto-seleccionando Agregar Persona');
          addRadio.click();
        }
      }, 300);
    }

    // Paso 5 (índice 4): Auto-seleccionar "Sale una persona"
    if (currentStepIndex === 4 && activeStep?.id === 'remove-person-option') {
      if (!showManagePeopleModal) setShowManagePeopleModal(true);

      window.setTimeout(() => {
        const removeRadio = document.getElementById('tour-remove-person-radio');
        if (removeRadio) {
          console.log('🎓 [Training] Auto-seleccionando Quitar Persona');
          removeRadio.click();
        }
      }, 300);
    }
  }, [activeModule, currentStepIndex, currentMode, rooms, showActionsModal, showManagePeopleModal]);

  // Training: Auto-abrir la rueda de acciones y modal de gestión de horas en el módulo de room-time
  useEffect(() => {
    if (activeModule?.id !== 'room-time' || currentMode !== 'interactive') return;
    const activeStep = activeModule.steps[currentStepIndex];

    // Paso 1 (índice 0): Solo habitación ocupada resaltada - cerrar todo
    if (currentStepIndex === 0 && activeStep?.id === 'select-occupied-room-time') {
      if (showActionsModal) {
        console.log('🎓 [Training] Cerrando rueda de acciones (navegación hacia atrás)');
        setShowActionsModal(false);
        setActionsDockVisible(false);
      }
      if (showHourManagementModal) {
        console.log('🎓 [Training] Cerrando modal de horas (navegación hacia atrás)');
        setShowHourManagementModal(false);
      }
    }

    // Paso 2 (índice 1): Mostrar la rueda de acciones para habitación ocupada
    if (currentStepIndex === 1 && activeStep?.id === 'action-wheel-time') {
      if (showHourManagementModal) {
        console.log('🎓 [Training] Cerrando modal de horas y mostrando rueda (navegación hacia atrás)');
        setShowHourManagementModal(false);
      }

      if (rooms.length > 0 && !showActionsModal) {
        const occupiedRoom = rooms.find(r => r.status === 'OCUPADA');
        if (occupiedRoom) {
          console.log('🎓 [Training] Auto-abriendo rueda de acciones para demostración de tiempo');
          openActionsDock(occupiedRoom);
        }
      }
    }

    // Paso 3 (índice 2): Auto-abrir modal de gestión de horas
    if (currentStepIndex === 2 && activeStep?.id === 'manage-time-modal') {
      if (showActionsModal && !showHourManagementModal) {
        window.setTimeout(() => {
          console.log('🎓 [Training] Auto-abriendo modal de gestión de horas');
          setShowHourManagementModal(true);
          setShowActionsModal(false);
        }, 500);
      } else if (!showHourManagementModal && !showActionsModal) {
        setShowHourManagementModal(true);
      }
    }

    // Paso 4 (índice 3): Auto-seleccionar "Horas Personalizadas"
    if (currentStepIndex === 3 && activeStep?.id === 'custom-hours-option') {
      if (!showHourManagementModal) setShowHourManagementModal(true);

      window.setTimeout(() => {
        const customOption = document.getElementById('tour-custom-hours-option');
        if (customOption) {
          console.log('🎓 [Training] Auto-seleccionando Horas Personalizadas');
          customOption.click();
        }
      }, 300);
    }

    // Paso 5 (índice 4): Auto-seleccionar "Renovar"
    if (currentStepIndex === 4 && activeStep?.id === 'renew-option') {
      if (!showHourManagementModal) {
        console.log('🎓 [Training] Abriendo modal para paso renew');
        setShowHourManagementModal(true);
      }

      window.setTimeout(() => {
        const renewOption = document.getElementById('tour-renew-option');
        if (renewOption) {
          console.log('🎓 [Training] Auto-seleccionando Renovar');
          renewOption.click();
        } else {
          console.warn('🎓 [Training] No se encontró el elemento tour-renew-option');
        }
      }, 50);
    }

    // Paso 6 (índice 5): Auto-seleccionar "Promo 4H"
    if (currentStepIndex === 5 && activeStep?.id === 'promos') {
      if (!showHourManagementModal) {
        console.log('🎓 [Training] Abriendo modal para paso promos');
        setShowHourManagementModal(true);
      }

      window.setTimeout(() => {
        const promoOption = document.getElementById('tour-promo4h-option');
        if (promoOption) {
          console.log('🎓 [Training] Auto-seleccionando Promoción 4H');
          promoOption.click();
        } else {
          console.warn('🎓 [Training] No se encontró el elemento tour-promo4h-option');
        }
      }, 50);
    }
  }, [activeModule, currentStepIndex, currentMode, rooms, showActionsModal, showHourManagementModal]);

  // Training: Auto-abrir la rueda de acciones en el módulo de room-status
  useEffect(() => {
    if (activeModule?.id === 'room-status' && currentMode === 'interactive') {
      const activeStep = activeModule.steps[currentStepIndex];

      const queueTrainingStatusUpdate = (fn: () => Promise<void>) => {
        trainingStatusUpdateChainRef.current = trainingStatusUpdateChainRef.current
          .then(fn)
          .catch((err) => {
            console.error('🎓 [Training] Error en update encadenado:', err);
          });
      };

      // Ejecutar acciones "al dar Siguiente" usando el cambio de step
      const prevStepId = trainingStatusPrevStepIdRef.current;
      const currentStepId = activeStep?.id ?? null;
      if (prevStepId === 'mark-clean-option' && currentStepId !== 'mark-clean-option') {
        const demoRoom = trainingStatusRoomIdRef.current
          ? rooms.find(r => r.id === trainingStatusRoomIdRef.current)
          : null;

        if (demoRoom) {
          console.log('🎓 [Training] Ejecutando acción al salir del paso: Limpiar (LIBRE)');
          // IMPORTANTE: no pasar notes para que updateRoomStatus limpie notes al liberar
          queueTrainingStatusUpdate(() => updateRoomStatus(demoRoom, 'LIBRE', 'Habitación limpia'));
        }
      }

      if (prevStepId === 'unblock-option' && currentStepId !== 'unblock-option') {
        const roomToUnblock = trainingStatusRoomIdRef.current
          ? rooms.find(r => r.id === trainingStatusRoomIdRef.current)
          : rooms.find(r => r.status === 'BLOQUEADA') || null;

        if (roomToUnblock) {
          console.log('🎓 [Training] Ejecutando acción al salir del paso: Desbloquear (LIBRE)');
          // IMPORTANTE: no pasar notes para que updateRoomStatus limpie notes al liberar
          queueTrainingStatusUpdate(() => updateRoomStatus(roomToUnblock, 'LIBRE', 'Habitación desbloqueada'));
        }
      }

      const timeouts: number[] = [];
      const addTimeout = (fn: () => void, ms: number) => {
        const id = window.setTimeout(fn, ms);
        timeouts.push(id);
      };

      const hasRoomWithStatus = (status: Room['status']) => {
        return rooms.some(r => r.status === status);
      };

      const ensureWheelOpenForStatus = (status: Room['status']) => {
        if (rooms.length === 0) return;

        const targetRoom = rooms.find(r => r.status === status);
        if (targetRoom) {
          // Evitar reabrir si ya está abierta para el mismo cuarto (evita parpadeo)
          if (showActionsModal && trainingWheelRoomIdRef.current === targetRoom.id) return;

          console.log(`🎓 [Training] Auto-abriendo rueda de acciones para habitación ${status}`);
          trainingWheelRoomIdRef.current = targetRoom.id;
          openActionsDock(targetRoom);
        }
      };

      const ensureWheelClosed = () => {
        if (showActionsModal) {
          console.log('🎓 [Training] Cerrando rueda de acciones');
          setShowActionsModal(false);
          setActionsDockVisible(false);
          trainingWheelRoomIdRef.current = null;
        }
      };

      // Reset triggers when leaving the step
      if (activeStep?.id !== 'mark-dirty-option') {
        trainingStatusDirtyTriggeredRef.current = false;
      }
      if (activeStep?.id !== 'block-room-option') {
        trainingStatusBlockTriggeredRef.current = false;
      }
      if (activeStep?.id !== 'mark-clean-option') {
        trainingStatusCleanTriggeredRef.current = false;
        trainingStatusCleanStepInitRef.current = false;
      }

      // Paso 1 (índice 0): Solo habitación libre resaltada - cerrar todo
      if (currentStepIndex === 0 && activeStep?.id === 'select-free-room') {
        ensureWheelClosed();
        if (showStatusNoteModal) {
          console.log('🎓 [Training] Cerrando modal de nota de estado (navegación hacia atrás)');
          setShowStatusNoteModal(false);
          setStatusNoteAction(null);
        }
      }

      // Pasos donde se necesita una habitación seleccionada (cerrar overlays)
      const needsRoomsView =
        activeStep?.id === 'select-dirty-room' ||
        activeStep?.id === 'select-blocked-room';

      if (needsRoomsView) {
        ensureWheelClosed();
        if (showStatusNoteModal) {
          console.log('🎓 [Training] Cerrando modal de nota (selección de habitación)');
          setShowStatusNoteModal(false);
          setStatusNoteAction(null);
        }
      }

      // Pasos que requieren la rueda abierta según el estado
      const wheelStatusNeeded: Room['status'] | null =
        activeStep?.id === 'action-wheel-status' ||
          activeStep?.id === 'info-dirty' ||
          activeStep?.id === 'info-clean' ||
          activeStep?.id === 'mark-dirty-option' ||
          activeStep?.id === 'block-room-option'
          ? 'LIBRE'
          : activeStep?.id === 'mark-clean-option'
            ? 'SUCIA'
            : activeStep?.id === 'unblock-option'
              ? 'BLOQUEADA'
              : null;

      // Mantener/abrir la rueda cuando el paso lo requiera
      if (wheelStatusNeeded) {
        // En mark-clean-option manejamos el modal/rueda más abajo (para permitir fallback)
        if (activeStep?.id !== 'mark-clean-option') {
          // En mark-dirty-option: si ya se disparó la automatización o ya está el modal DIRTY, no re-abrir la rueda
          if (
            activeStep?.id === 'mark-dirty-option' &&
            (trainingStatusDirtyTriggeredRef.current || (showStatusNoteModal && statusNoteAction === 'DIRTY'))
          ) {
            ensureWheelClosed();
          } else if (
            activeStep?.id === 'block-room-option' &&
            (trainingStatusBlockTriggeredRef.current || (showStatusNoteModal && statusNoteAction === 'BLOCK'))
          ) {
            // Mantener visible el modal de bloqueo durante el paso
            ensureWheelClosed();
          } else {
            if (showStatusNoteModal) {
              console.log('🎓 [Training] Cerrando modal de nota y mostrando rueda (navegación hacia atrás)');
              setShowStatusNoteModal(false);
              setStatusNoteAction(null);
            }

            ensureWheelOpenForStatus(wheelStatusNeeded);
            addTimeout(() => ensureWheelOpenForStatus(wheelStatusNeeded), 300);
          }
        }
      }

      // Paso 5: Marcar como sucia -> abrir modal automáticamente (simulando click en el sector)
      if (activeStep?.id === 'mark-dirty-option') {
        if (!hasRoomWithStatus('LIBRE')) return;

        // Si ya se abrió el modal, no repetir
        if (showStatusNoteModal) return;

        // Evitar loops: ejecutar una sola vez al entrar al paso
        if (trainingStatusDirtyTriggeredRef.current) return;
        trainingStatusDirtyTriggeredRef.current = true;

        // Seleccionar habitación demo
        const roomForDirty =
          (trainingStatusRoomIdRef.current
            ? rooms.find(r => r.id === trainingStatusRoomIdRef.current)
            : null) ||
          selectedRoom ||
          rooms.find(r => r.status === 'LIBRE') ||
          null;

        if (!roomForDirty) return;
        trainingStatusRoomIdRef.current = roomForDirty.id;

        // Cerrar la rueda antes del modal
        ensureWheelClosed();

        console.log('🎓 [Training] Abriendo modal: Marcar como Sucia');
        setSelectedRoom({ ...roomForDirty, notes: 'Capacitación' } as Room);
        setStatusNoteAction('DIRTY');
        setShowStatusNoteModal(true);

        // Marcar SUCIA para preparar el paso 6 (sin cerrar modal)
        console.log('🎓 [Training] Marcando habitación demo como SUCIA (sin cerrar modal)');
        queueTrainingStatusUpdate(() => updateRoomStatus(roomForDirty, 'SUCIA', 'Habitación marcada como sucia/mantenimiento', 'Capacitación'));
      }

      // Paso 7 (bloqueo/mantenimiento): abrir modal automáticamente y marcar como BLOQUEADA
      if (activeStep?.id === 'block-room-option') {
        if (!hasRoomWithStatus('LIBRE')) return;

        // Si ya se abrió el modal, no repetir
        if (showStatusNoteModal) return;

        // Evitar loops: ejecutar una sola vez al entrar al paso
        if (trainingStatusBlockTriggeredRef.current) return;
        trainingStatusBlockTriggeredRef.current = true;

        const roomForBlock =
          (trainingStatusRoomIdRef.current
            ? rooms.find(r => r.id === trainingStatusRoomIdRef.current)
            : null) ||
          selectedRoom ||
          rooms.find(r => r.status === 'LIBRE') ||
          null;

        if (!roomForBlock) return;
        trainingStatusRoomIdRef.current = roomForBlock.id;

        // Cerrar la rueda antes del modal
        ensureWheelClosed();

        console.log('🎓 [Training] Abriendo modal: Bloquear (Mantenimiento)');
        setSelectedRoom({ ...roomForBlock, notes: 'Capacitación' } as Room);
        setStatusNoteAction('BLOCK');
        setShowStatusNoteModal(true);

        // Marcar BLOQUEADA para preparar el siguiente paso (sin cerrar modal)
        console.log('🎓 [Training] Marcando habitación demo como BLOQUEADA (sin cerrar modal)');
        queueTrainingStatusUpdate(() => updateRoomStatus(roomForBlock, 'BLOQUEADA', 'Habitación bloqueada', 'Capacitación'));
      }

      // Paso 6: Cerrar modal y abrir rueda para una SUCIA si existe; si no, dejar solo el modal
      if (activeStep?.id === 'mark-clean-option') {
        const roomRef = trainingStatusRoomIdRef.current
          ? rooms.find(r => r.id === trainingStatusRoomIdRef.current)
          : null;

        // Ejecutar la preparación del paso una sola vez (evita loops por auto-refresh)
        if (!trainingStatusCleanStepInitRef.current) {
          trainingStatusCleanStepInitRef.current = true;

          // Cerrar modal de nota (si estaba visible) para poder ver la rueda
          if (showStatusNoteModal) {
            console.log('🎓 [Training] Cerrando modal de nota antes de mostrar opción Limpiar');
            setShowStatusNoteModal(false);
            setStatusNoteAction(null);
          }

          // Si NO existe ninguna SUCIA y aún no se ha limpiado, preparar una habitación demo como SUCIA
          // (solo para que se pueda visualizar la opción Limpiar).
          const hasDirtyNow = hasRoomWithStatus('SUCIA');
          if (!hasDirtyNow && roomRef && !trainingStatusCleanTriggeredRef.current) {
            addTimeout(() => {
              console.log('🎓 [Training] Preparando habitación demo como SUCIA');
              updateRoomStatus(roomRef, 'SUCIA', 'Habitación marcada como sucia/mantenimiento', 'Capacitación');
            }, 100);
          }
        }

        // Si hay SUCIA (por demo o ya existente), abrir rueda para mostrar opción limpiar
        addTimeout(() => {
          if (hasRoomWithStatus('SUCIA')) {
            ensureWheelOpenForStatus('SUCIA');
          } else {
            // Fallback: si no hay SUCIA, mostrar solo el modal (sin rueda)
            ensureWheelClosed();
          }
        }, 800);

        addTimeout(() => {
          if (hasRoomWithStatus('SUCIA')) {
            ensureWheelOpenForStatus('SUCIA');
          }
        }, 1400);

      }

      trainingStatusPrevStepIdRef.current = activeStep?.id ?? null;

      return () => {
        timeouts.forEach(id => clearTimeout(id));
      };
    }
  }, [activeModule, currentStepIndex, currentMode, rooms, showActionsModal, showStatusNoteModal, statusNoteAction, selectedRoom]);

  // Función para recargar habitaciones (silent = true para refresh sin parpadeo)
  const fetchRooms = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("rooms")
        .select(
          `id, number, status, notes, room_types:room_type_id ( id, name, base_price, weekday_hours, weekend_hours, is_hotel, extra_person_price, extra_hour_price, max_people ), room_stays ( id, sales_order_id, status, check_in_at, expected_check_out_at, current_people, total_people, tolerance_started_at, tolerance_type, vehicle_plate, vehicle_brand, vehicle_model, valet_employee_id, checkout_valet_employee_id, valet_checkout_requested_at, vehicle_requested_at, guest_access_token, checkout_payment_data, sales_orders ( remaining_amount ) )`
        );

      if (error) {
        console.error("Error loading rooms:", error);
        if (!silent) setRooms([]);
        return;
      }

      // Ordenar: primero las que NO son tipo Torre/Hotel, luego las Torre
      // Dentro de cada grupo, ordenar por número
      const sortedRooms = (data as any[])?.sort((a, b) => {
        const aIsTorre = a.room_types?.is_hotel === true;
        const bIsTorre = b.room_types?.is_hotel === true;

        // Si uno es Torre y el otro no, el que no es Torre va primero
        if (aIsTorre !== bIsTorre) {
          return aIsTorre ? 1 : -1;
        }

        // Si ambos son del mismo tipo, ordenar por número
        return a.number.localeCompare(b.number, undefined, { numeric: true });
      }) || [];

      setRooms(sortedRooms);
    } catch (err) {
      console.error("Error fetching rooms:", err);
      if (!silent) setRooms([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Suscripción a cambios en tiempo real
  useEffect(() => {
    const supabase = createClient();
    let isSubscribed = true;
    let channel: any = null;

    console.log("🔌 [RoomBoard] Configurando suscripción en tiempo real...");

    // Función para configurar el canal con autenticación
    const setupRealtimeChannel = async () => {
      try {
        // Obtener sesión actual y configurar auth para Realtime
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          // IMPORTANTE: Vincular el token de auth al cliente Realtime
          supabase.realtime.setAuth(session.access_token);
          console.log("🔑 [RoomBoard] Token de autenticación configurado para Realtime");
        } else {
          console.warn("⚠️ [RoomBoard] No hay sesión activa - Realtime puede fallar con RLS");
        }

        channel = supabase
          .channel('rooms-board-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'rooms' },
            (payload: any) => {
              if (!isSubscribed) return;
              console.log("📡 [RoomBoard] Cambio detectado en 'rooms':", {
                event: payload.eventType,
                roomId: payload.new?.id || payload.old?.id,
                status: payload.new?.status || payload.old?.status,
              });
              fetchRooms(true);
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'room_stays' },
            (payload: any) => {
              if (!isSubscribed) return;
              console.log("📡 [RoomBoard] Cambio detectado en 'room_stays':", {
                event: payload.eventType,
                stayId: payload.new?.id || payload.old?.id,
                vehiclePlate: payload.new?.vehicle_plate,
                valetId: payload.new?.valet_employee_id,
                checkoutValetId: payload.new?.checkout_valet_employee_id,
                valetCheckoutRequested: payload.new?.valet_checkout_requested_at,
              });
              fetchRooms(true);
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'payments' },
            (payload: any) => {
              if (!isSubscribed) return;
              console.log("📡 [RoomBoard] Cambio detectado en 'payments':", {
                event: payload.eventType,
                paymentId: payload.new?.id || payload.old?.id,
                status: payload.new?.status,
              });
              fetchRooms(true);
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'sales_orders' },
            (payload: any) => {
              if (!isSubscribed) return;
              console.log("📡 [RoomBoard] Cambio detectado en 'sales_orders':", {
                event: payload.eventType,
                orderId: payload.new?.id || payload.old?.id,
              });
              fetchRooms(true);
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'sales_order_items' },
            (payload: any) => {
              if (!isSubscribed) return;
              console.log("📡 [RoomBoard] Cambio detectado en 'sales_order_items':", {
                event: payload.eventType,
                itemId: payload.new?.id || payload.old?.id,
                concept: payload.new?.concept_type,
              });
              fetchRooms(true);
            }
          )
          .subscribe((status: string, err?: Error) => {
            // Reaccionar al estado real de la conexión
            if (status === 'SUBSCRIBED') {
              console.log("✅ [RoomBoard] Conexión en tiempo real ACTIVADA");
            } else if (status === 'CHANNEL_ERROR') {
              console.warn("⚠️ [RoomBoard] Error en canal Realtime", err?.message || '');
            } else if (status === 'TIMED_OUT') {
              console.warn("⏱️ [RoomBoard] Timeout de conexión");
            } else if (status === 'CLOSED') {
              console.log("🚪 [RoomBoard] Conexión cerrada");
            }
          });
      } catch (error) {
        console.error("❌ [RoomBoard] Error configurando Realtime:", error);
      }
    };

    // Ejecutar la configuración
    setupRealtimeChannel();

    // Cleanup function
    return () => {
      isSubscribed = false;
      console.log("🔌 [RoomBoard] Cerrando suscripción en tiempo real...");
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []); // 👈 Sin dependencias - solo se ejecuta una vez al montar

  // Hook de acciones de habitación
  const {
    actionLoading,
    handleAddPerson,
    handleRemovePerson,
    handlePersonLeftReturning,
    // handleAddExtraHour removida - usar handleAddCustomHours
    handleAddCustomHours,
    handleRenewRoom,
    handleAdd4HourPromo,
    updateRoomStatus,
    prepareCheckout,
    processCheckout,
    requestVehicle,
    handleAddDamageCharge,
    handleAuthorizeValetCheckout,
  } = useRoomActions(async () => await fetchRooms(true));

  useEffect(() => {
    const isRoomStatusTourActive = activeModule?.id === 'room-status' && currentMode === 'interactive';

    if (isRoomStatusTourActive) {
      trainingStatusWasActiveRef.current = true;
      trainingStatusEndCleanupRef.current = false;
      return;
    }

    if (!trainingStatusWasActiveRef.current) return;
    if (trainingStatusEndCleanupRef.current) return;
    trainingStatusEndCleanupRef.current = true;
    trainingStatusWasActiveRef.current = false;

    const demoRoom = trainingStatusRoomIdRef.current
      ? rooms.find(r => r.id === trainingStatusRoomIdRef.current)
      : null;

    if (!demoRoom) return;

    trainingStatusUpdateChainRef.current = trainingStatusUpdateChainRef.current
      .then(() => updateRoomStatus(demoRoom, 'LIBRE', 'Habitación desbloqueada'))
      .catch((err) => {
        console.error('🎓 [Training] Error en cleanup final:', err);
      });
  }, [activeModule, currentMode, rooms, updateRoomStatus]);

  // Abrir modal de checkout usando el hook
  const openCheckoutModal = async (room: Room) => {
    const info = await prepareCheckout(room);
    if (info) {
      // Obtener items pendientes por concepto
      const supabase = createClient();
      const { data: itemsData } = await supabase
        .from("sales_order_items")
        .select("concept_type, total, is_paid")
        .eq("sales_order_id", info.salesOrderId);

      // Agrupar por concepto los items no pagados
      const pendingByType: Record<string, { total: number; count: number }> = {};
      if (itemsData) {
        itemsData.forEach((item: any) => {
          if (!item.is_paid) {
            const type = item.concept_type || "PRODUCT";
            if (!pendingByType[type]) {
              pendingByType[type] = { total: 0, count: 0 };
            }
            pendingByType[type].total += item.total || 0;
            pendingByType[type].count += 1;
          }
        });
      }

      const pendingItems = Object.entries(pendingByType).map(([concept_type, data]) => ({
        concept_type,
        total: data.total,
        count: data.count,
      }));

      setCheckoutInfo({ ...info, pendingItems });
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
  // Procesar checkout usando el hook
  const handleCheckout = async (data: { payments: PaymentEntry[]; checkoutValetId?: string | null; checkoutValetName?: string }) => {
    if (!checkoutInfo || !selectedRoom) return;
    const success = await processCheckout(selectedRoom, checkoutInfo, checkoutAmount, data.payments, data.checkoutValetId);
    if (success) {
      // Imprimir ticket de salida
      try {
        const activeStay = getActiveStay(selectedRoom);
        const printData: ConsumptionTicketData = {
          roomNumber: selectedRoom.number,
          folio: `${checkoutInfo.salesOrderId.slice(0, 8)}`,
          date: new Date(),
          items: checkoutInfo.pendingItems ? checkoutInfo.pendingItems.map(item => ({
            name: `${item.concept_type} x${item.count}`,
            qty: item.count,
            price: item.total / item.count,
            total: item.total
          })) : [],
          subtotal: checkoutAmount,
          total: checkoutAmount,
          entranceValet: activeStay?.vehicle_plate ? 'Solicitado' : undefined,
          exitValet: data.checkoutValetName // Nombre del valet de salida
        };
        // printConsumptionTickets(printData); // DESHABILITADO POR SOLICITUD
      } catch (e) {
        console.error("Error printing exit ticket", e);
      }

      setShowCheckoutModal(false);
      setSelectedRoom(null);
      setCheckoutInfo(null);
      setCheckoutAmount(0);
    }
  };

  // Abrir modal de pagar extras
  const openPayExtraModal = async (room: Room) => {
    const info = await prepareCheckout(room);
    if (info && info.remainingAmount > 0) {
      setPayExtraInfo({
        salesOrderId: info.salesOrderId,
        extraAmount: info.remainingAmount,
      });
      setPayExtraAmount(info.remainingAmount);
      setSelectedRoom(room);
      setShowPayExtraModal(true);
    } else {
      toast.info("Sin cargos pendientes", {
        description: "No hay cargos extra por pagar en esta habitación.",
      });
    }
  };

  // Abrir modal de cobro granular (por concepto)
  const openGranularPaymentModal = async (room: Room) => {
    const activeStay = getActiveStay(room);
    if (!activeStay?.sales_order_id) {
      toast.error("No se encontró una orden activa");
      return;
    }
    setGranularPaymentOrderId(activeStay.sales_order_id);
    setSelectedRoom(room);
    setShowGranularPaymentModal(true);
  };

  // Cerrar modal de cobro granular
  const handleCloseGranularPaymentModal = () => {
    setShowGranularPaymentModal(false);
    setGranularPaymentOrderId(null);
  };

  // Completar cobro granular
  const handleGranularPaymentComplete = () => {
    setShowGranularPaymentModal(false);
    setGranularPaymentOrderId(null);
    fetchRooms(true);
  };

  // Abrir modal de agregar consumo
  const openConsumptionModal = async (room: Room) => {
    const activeStay = getActiveStay(room);
    if (!activeStay?.sales_order_id) {
      toast.error("No se encontró una orden activa");
      return;
    }
    setConsumptionOrderId(activeStay.sales_order_id);
    setSelectedRoom(room);
    setShowConsumptionModal(true);
  };

  // Cerrar modal de consumo
  const handleCloseConsumptionModal = () => {
    setShowConsumptionModal(false);
    setConsumptionOrderId(null);
  };

  // Completar agregar consumo
  const handleConsumptionComplete = () => {
    setShowConsumptionModal(false);
    setConsumptionOrderId(null);
    fetchRooms(true);
  };

  // Manejar notificación de salida (Valet)
  const handleNotifyCheckout = async () => {
    if (!selectedRoom || !isValet) return;

    // Obtener estancia activa
    const activeStay = getActiveStay(selectedRoom);
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
        description: `Habitación ${selectedRoom.number}`
      });
      setShowActionsModal(false);
      fetchRooms(true);
    } catch (error) {
      console.error("Error notifying checkout:", error);
      toast.error("Error al notificar salida");
    }
  };

  // Cerrar modal de pagar extras
  const handleClosePayExtraModal = () => {
    if (actionLoading) return;
    setShowPayExtraModal(false);
    setSelectedRoom(null);
    setPayExtraInfo(null);
    setPayExtraAmount(0);
  };

  // Procesar pago de extras (sin checkout)
  const handlePayExtra = async (payments: PaymentEntry[]) => {
    if (!payExtraInfo || !selectedRoom || payments.length === 0) return;

    const supabase = createClient();
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    try {
      // Obtener la orden actual
      const { data: order, error: orderError } = await supabase
        .from("sales_orders")
        .select("paid_amount, remaining_amount")
        .eq("id", payExtraInfo.salesOrderId)
        .single();

      if (orderError || !order) {
        toast.error("Error al obtener la orden");
        return;
      }

      // Buscar pagos pendientes existentes para esta orden
      const { data: pendingPayments, error: pendingError } = await supabase
        .from("payments")
        .select("id, amount, concept")
        .eq("sales_order_id", payExtraInfo.salesOrderId)
        .eq("status", "PENDIENTE")
        .is("parent_payment_id", null)
        .order("created_at", { ascending: true });

      if (pendingError) {
        console.error("Error fetching pending payments:", pendingError);
      }

      const validPayments = payments.filter(p => p.amount > 0);
      const isMultipago = validPayments.length > 1;
      let remainingToPay = totalPaid;

      // Obtener turno actual para vincular nuevos pagos
      const currentShiftId = await getCurrentShiftId(supabase);

      // Actualizar pagos pendientes existentes
      if (pendingPayments && pendingPayments.length > 0) {
        for (const pending of pendingPayments) {
          if (remainingToPay <= 0) break;

          const amountForThis = Math.min(pending.amount, remainingToPay);
          remainingToPay -= amountForThis;

          if (isMultipago) {
            // Actualizar el pago pendiente a PAGADO y agregar subpagos
            await supabase
              .from("payments")
              .update({
                status: "PAGADO",
                payment_method: "PENDIENTE",
              })
              .eq("id", pending.id);

            // Crear subpagos proporcionales para este pago pendiente
            const proportion = amountForThis / totalPaid;
            const subpayments = validPayments.map(p => ({
              sales_order_id: payExtraInfo.salesOrderId,
              amount: Math.round(p.amount * proportion * 100) / 100,
              payment_method: p.method,
              reference: p.reference || generatePaymentReference("SUB"),
              concept: pending.concept,
              status: "PAGADO",
              payment_type: "PARCIAL",
              parent_payment_id: pending.id,
              shift_session_id: currentShiftId,
            }));

            const { error: subError } = await supabase
              .from("payments")
              .insert(subpayments);

            if (subError) {
              console.error("Error inserting subpayments:", subError);
            }
          } else {
            // Pago único - actualizar el pago pendiente directamente
            const p = validPayments[0];
            await supabase
              .from("payments")
              .update({
                status: "PAGADO",
                payment_method: p.method,
                reference: p.reference || generatePaymentReference("PAG"),
              })
              .eq("id", pending.id);
          }
        }
      }

      // Si sobra monto (no había suficientes pagos pendientes), crear pago nuevo genérico
      if (remainingToPay > 0) {
        if (isMultipago) {
          const { data: mainPayment, error: mainError } = await supabase
            .from("payments")
            .insert({
              sales_order_id: payExtraInfo.salesOrderId,
              amount: remainingToPay,
              payment_method: "PENDIENTE",
              reference: generatePaymentReference("EXT"),
              concept: "PAGO_EXTRA",
              status: "PAGADO",
              payment_type: "COMPLETO",
              shift_session_id: currentShiftId,
            })
            .select("id")
            .single();

          if (!mainError && mainPayment) {
            const proportion = remainingToPay / totalPaid;
            const subpayments = validPayments.map(p => ({
              sales_order_id: payExtraInfo.salesOrderId,
              amount: Math.round(p.amount * proportion * 100) / 100,
              payment_method: p.method,
              reference: p.reference || generatePaymentReference("SUB"),
              concept: "PAGO_EXTRA",
              status: "PAGADO",
              payment_type: "PARCIAL",
              parent_payment_id: mainPayment.id,
              shift_session_id: currentShiftId,
            }));

            await supabase.from("payments").insert(subpayments);
          }
        } else {
          const p = validPayments[0];
          await supabase.from("payments").insert({
            sales_order_id: payExtraInfo.salesOrderId,
            amount: remainingToPay,
            payment_method: p.method,
            reference: p.reference || generatePaymentReference("EXT"),
            concept: "PAGO_EXTRA",
            status: "PAGADO",
            payment_type: "COMPLETO",
            shift_session_id: currentShiftId,
          });
        }
      }

      // Actualizar montos pagados
      const newPaidAmount = (order.paid_amount || 0) + totalPaid;
      const newRemainingAmount = Math.max(0, (order.remaining_amount || 0) - totalPaid);

      const { error: updateError } = await supabase
        .from("sales_orders")
        .update({
          paid_amount: newPaidAmount,
          remaining_amount: newRemainingAmount,
        })
        .eq("id", payExtraInfo.salesOrderId);

      if (updateError) {
        toast.error("Error al procesar el pago");
        return;
      }

      const methodsSummary = payments.map(p => `${p.method}: $${p.amount.toFixed(2)}`).join(', ');
      toast.success("Pago registrado", {
        description: `Se pagaron $${totalPaid.toFixed(2)} MXN (${methodsSummary}). La habitación sigue ocupada.`,
      });

      setShowPayExtraModal(false);
      setSelectedRoom(null);
      setPayExtraInfo(null);
      setPayExtraAmount(0);
      await fetchRooms(true);
    } catch (error) {
      console.error("Error paying extra:", error);
      toast.error("Error al procesar el pago");
    }
  };

  // Verificar si una habitación tiene cargos extra pendientes
  const hasExtraCharges = (room: Room): boolean => {
    const activeStay = getActiveStay(room);
    if (!activeStay?.sales_orders) return false;
    return (activeStay.sales_orders.remaining_amount || 0) > 0;
  };

  // Cargar habitaciones al montar (la suscripción realtime está en el useEffect anterior)
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

            // Usar sonido centralizado
            playAlert();

            setReminderAlert({ roomNumber: room.number, minutes: diffMinutes, level: "5" });
          }
        });
      } catch (e) {
        console.error("Error checking room reminders", e);
      }
    }, 60000); // Revisar cada minuto

    return () => clearInterval(interval);
  }, [rooms, reminderNotifiedStayIds20, reminderNotifiedStayIds5]);

  // Verificar tolerancias expiradas, limpiezas de salida y reactivaciones
  useEffect(() => {
    const processRoomTransitions = async () => {
      const supabase = createClient();
      const now = new Date();

      for (const room of rooms) {
        // Enfoque en habitaciones OCUPADAS con estancia ACTIVA
        if (room.status === "OCUPADA" && !room.room_types?.is_hotel) {
          const activeStay = getActiveStay(room);
          if (!activeStay) continue;

          // A. Verificar tolerancias de personas/vacío (EXISTENTE)
          if (activeStay.tolerance_started_at && activeStay.tolerance_type) {
            // ... existente ...
          }

          // B. Verificar cobro automático si ya pasaron los 30 min de gracia
          if (activeStay.expected_check_out_at && room.room_types?.extra_hour_price) {
            const expected = new Date(activeStay.expected_check_out_at);
            const diffMs = now.getTime() - expected.getTime();

            if (diffMs > EXIT_TOLERANCE_MS) {
              // Verificar si ya existen cargos o pagos pendientes de EXTRA_HOUR
              const { data: existingExtraPayments } = await supabase
                .from("payments")
                .select("id")
                .eq("sales_order_id", activeStay.sales_order_id)
                .eq("concept", "EXTRA_HOUR")
                .eq("status", "PENDIENTE");

              if (!existingExtraPayments || existingExtraPayments.length === 0) {
                // AUTO EXTRA HOUR: Crear cobro automático de 1 hora extra
                const extraHourPrice = room.room_types.extra_hour_price;

                try {
                  // 1. Crear item de servicio para la hora extra usando el servicio centralizado
                  const itemResult = await createServiceItem(
                    activeStay.sales_order_id,
                    extraHourPrice,
                    "EXTRA_HOUR",
                    1
                  );

                  const consumptionId = itemResult.success ? itemResult.data : undefined;

                  // 2. Crear pago pendiente
                  const currentShiftId = await getCurrentShiftId(supabase);
                  await supabase.from("payments").insert({
                    sales_order_id: activeStay.sales_order_id,
                    amount: extraHourPrice,
                    payment_method: "PENDIENTE",
                    reference: generatePaymentReference("AEH"), // Auto Extra Hour
                    concept: "EXTRA_HOUR",
                    status: "PENDIENTE",
                    payment_type: "COMPLETO",
                    shift_session_id: currentShiftId,
                  });

                  // 3. Actualizar remaining_amount en sales_orders
                  const { data: orderData } = await supabase
                    .from("sales_orders")
                    .select("remaining_amount, subtotal, total")
                    .eq("id", activeStay.sales_order_id)
                    .single();

                  if (orderData) {
                    const newRemaining = (Number(orderData.remaining_amount) || 0) + extraHourPrice;
                    const newSubtotal = (Number(orderData.subtotal) || 0) + extraHourPrice;
                    const newTotal = (Number(orderData.total) || 0) + extraHourPrice;

                    await supabase.from("sales_orders").update({
                      remaining_amount: newRemaining,
                      subtotal: newSubtotal,
                      total: newTotal,
                    }).eq("id", activeStay.sales_order_id);
                  }

                  // 4. Extender expected_check_out_at en 1 hora
                  const newExpectedCheckout = new Date(expected);
                  newExpectedCheckout.setHours(newExpectedCheckout.getHours() + 1);

                  await supabase.from("room_stays").update({
                    expected_check_out_at: newExpectedCheckout.toISOString(),
                  }).eq("id", activeStay.id);

                  // 5. Enviar notificación push a cocheros
                  try {
                    await fetch('/api/push/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: '⏰ Hora Extra Automática',
                        body: `Habitación ${room.number}: Se agregó 1 hora extra automáticamente. Cobrar $${extraHourPrice.toFixed(0)}.`,
                        roles: ['valet', 'cochero'],
                        url: '/valet',
                        tag: `auto-hex-${activeStay.id}-${Date.now()}`,
                        data: {
                          type: 'NEW_EXTRA',
                          consumptionId: consumptionId,
                          roomNumber: room.number,
                          stayId: activeStay.id,
                        }
                      })
                    });
                  } catch (pushErr) {
                    console.error("Error sending push notification:", pushErr);
                  }

                  // 6. Mostrar toast solo si estamos en la página
                  toast.info(`Hora extra automática - Hab. ${room.number}`, {
                    description: `Se agregó 1 hora extra ($${extraHourPrice.toFixed(0)}) automáticamente.`,
                  });

                  console.log(`[AUTO EXTRA HOUR] Created charge for room ${room.number}: $${extraHourPrice}`);
                } catch (err) {
                  console.error(`[AUTO EXTRA HOUR] Error creating charge for room ${room.number}:`, err);
                }
              }
            }
          }
        }
      }
    };

    const interval = setInterval(processRoomTransitions, 60000); // Cada minuto
    processRoomTransitions();
    return () => clearInterval(interval);
  }, [rooms, fetchRooms]);

  const calculateExpectedCheckout = (roomType: RoomType) => {
    const now = new Date();

    if (roomType.is_hotel) {
      // Hotel (Torre): check-out siempre a las 12 pm del día siguiente
      const checkout = new Date(now);
      checkout.setDate(checkout.getDate() + 1);
      checkout.setHours(12, 0, 0, 0);
      return checkout;
    }

    // Motel: Determinar si estamos en período de fin de semana o entre semana
    // Fin de semana: Viernes 6:00 AM - Domingo 6:00 AM (8 horas)
    // Entre semana: Domingo 6:00 AM - Viernes 6:00 AM (12 horas)

    const day = now.getDay(); // 0=Domingo, 1=Lunes, ..., 5=Viernes, 6=Sábado
    const hour = now.getHours(); // 0-23

    let isWeekendPeriod = false;

    if (day === 5 && hour >= 6) {
      // Viernes desde las 6:00 AM en adelante
      isWeekendPeriod = true;
    } else if (day === 6) {
      // Todo el sábado
      isWeekendPeriod = true;
    } else if (day === 0 && hour < 6) {
      // Domingo antes de las 6:00 AM
      isWeekendPeriod = true;
    }

    const hours = isWeekendPeriod
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

  const getRemainingTimeLabel = (room: Room) => {
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
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;

    const labelParts = [] as string[];
    if (hours > 0) labelParts.push(`${hours}h`);
    labelParts.push(`${minutes}m`);

    return {
      eta: formatDateTime(checkout),
      remaining: diffMinutes < 0 ? `+${labelParts.join(" ")}` : labelParts.join(" "),
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

  // Abrir modal para bloquear con nota
  const handleOpenBlockModal = (room: Room) => {
    setSelectedRoom(room);
    setStatusNoteAction("BLOCK");
    setShowStatusNoteModal(true);
  };

  // Abrir modal para marcar sucia con nota
  const handleOpenDirtyModal = (room: Room) => {
    setSelectedRoom(room);
    setStatusNoteAction("DIRTY");
    setShowStatusNoteModal(true);
  };

  // Confirmar cambio de estado con nota
  const handleConfirmStatusChange = async (note: string) => {
    if (!selectedRoom || !statusNoteAction) return;

    if (statusNoteAction === "BLOCK") {
      await updateRoomStatus(selectedRoom, "BLOQUEADA", "Habitación bloqueada", note);
    } else if (statusNoteAction === "DIRTY") {
      await updateRoomStatus(selectedRoom, "SUCIA", "Habitación marcada como sucia/mantenimiento", note);
    }

    setShowStatusNoteModal(false);
    setStatusNoteAction(null);
    setSelectedRoom(null);
  };


  const handleStartStay = async (initialPeople: number, payments: PaymentEntry[], vehicle: VehicleInfo) => {
    if (!selectedRoom || !selectedRoom.room_types) return;

    const isAuthed = await ensureAuthenticated();
    if (!isAuthed) return;

    setStartStayLoading(true);
    const supabase = createClient();
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const methodsSummary = payments.map(p => p.method).join(', ');

    try {
      const roomType = selectedRoom.room_types;
      const now = new Date();
      const expectedCheckout = calculateExpectedCheckout(roomType);

      const basePrice = roomType.base_price ?? 0;
      const extraPersonPrice = roomType.extra_person_price ?? 0;

      // Calcular costo extra por personas adicionales (más de 2)
      const extraPeopleCount = Math.max(0, initialPeople - 2);
      const extraPeopleCost = extraPeopleCount * extraPersonPrice;
      const totalPrice = basePrice + extraPeopleCost;

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

      // Obtener turno actual y employee_id
      const currentShiftId = await getCurrentShiftId(supabase);
      const currentEmployeeId = await getCurrentEmployeeId(supabase);

      // FIX #1: Verificar que la habitación siga disponible antes de proceder
      const { data: currentRoomStatus, error: statusCheckError } = await supabase
        .from("rooms")
        .select("status")
        .eq("id", selectedRoom.id)
        .single();

      if (statusCheckError || !currentRoomStatus) {
        toast.error("Error al verificar disponibilidad", {
          description: "No se pudo comprobar el estado actual de la habitación.",
        });
        return;
      }

      if (currentRoomStatus.status !== "LIBRE") {
        toast.error("Habitación no disponible", {
          description: `La habitación ${selectedRoom.number} ya NO está disponible. Estado actual: ${currentRoomStatus.status}`,
        });
        return;
      }

      // Crear orden de venta básica para la estancia
      const { data: salesOrder, error: orderError } = await supabase
        .from("sales_orders")
        .insert({
          customer_id: null,
          warehouse_id: defaultWarehouse.id,
          currency: "MXN",
          notes: `Estancia ${roomType.name} Hab. ${selectedRoom.number}${extraPeopleCount > 0 ? ` (+${extraPeopleCount} extra)` : ''} - Pago: ${methodsSummary}`,
          subtotal: totalPrice,
          tax: 0,
          total: totalPrice,
          status: "OPEN",
          remaining_amount: Math.max(0, totalPrice - totalPaid),
          paid_amount: totalPaid,
          created_by: user?.id ?? null,
          shift_session_id: currentShiftId,
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

      // Insertar items en sales_order_items para cobro granular
      // Nota: 'total' es columna generada, no se incluye en el insert
      // Primero buscar o crear un producto "servicio" para habitaciones
      let serviceProductId: string | null = null;

      const { data: serviceProducts } = await supabase
        .from("products")
        .select("id")
        .eq("sku", "SVC-ROOM")
        .limit(1);

      if (serviceProducts && serviceProducts.length > 0) {
        serviceProductId = serviceProducts[0].id;
      } else {
        // Crear producto de servicio si no existe
        const { data: newProduct, error: productError } = await supabase
          .from("products")
          .insert({
            name: "Servicio de Habitación",
            sku: "SVC-ROOM",
            description: "Servicios de habitación (estancia, horas extra, personas extra)",
            price: 0,
            cost: 0,
            unit: "SVC",
            min_stock: 0,
            is_active: true,
          })
          .select("id")
          .single();

        if (productError) {
          console.error("Error creating service product:", productError);
          // Continuar sin items granulares
        } else if (newProduct) {
          serviceProductId = newProduct.id;
        }
      }

      // Solo insertar items si tenemos un product_id válido
      if (serviceProductId) {
        const orderItems = [];

        // Item de habitación base
        orderItems.push({
          sales_order_id: salesOrder.id,
          product_id: serviceProductId,
          qty: 1,
          unit_price: basePrice,
          concept_type: "ROOM_BASE",
          is_paid: totalPaid >= basePrice,
          paid_at: totalPaid >= basePrice ? new Date().toISOString() : null,
          payment_method: totalPaid >= basePrice ? (payments.length === 1 ? payments[0].method : "MIXTO") : null,
        });

        // Items de personas extra (si aplica)
        if (extraPeopleCount > 0 && extraPersonPrice > 0) {
          for (let i = 0; i < extraPeopleCount; i++) {
            const itemTotal = basePrice + (i + 1) * extraPersonPrice;
            const isPaidUpToThis = totalPaid >= itemTotal;
            orderItems.push({
              sales_order_id: salesOrder.id,
              product_id: serviceProductId,
              qty: 1,
              unit_price: extraPersonPrice,
              concept_type: "EXTRA_PERSON",
              is_paid: isPaidUpToThis,
              paid_at: isPaidUpToThis ? new Date().toISOString() : null,
              payment_method: isPaidUpToThis ? (payments.length === 1 ? payments[0].method : "MIXTO") : null,
            });
          }
        }

        const { error: itemsError } = await supabase
          .from("sales_order_items")
          .insert(orderItems);

        if (itemsError) {
          console.error("Error inserting order items:", itemsError);
          // No es crítico, continuar
        }
      }

      // Insertar cargo principal y subpagos si es multipago
      if (payments.length > 0) {
        const totalPaidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        const validPayments = payments.filter(p => p.amount > 0);
        const isMultipago = validPayments.length > 1;
        const isPagado = totalPaidAmount >= basePrice;

        if (isMultipago) {
          // MULTIPAGO: Crear cargo principal + subpagos
          const { data: mainPayment, error: mainError } = await supabase
            .from("payments")
            .insert({
              sales_order_id: salesOrder.id,
              amount: basePrice,
              payment_method: "PENDIENTE",
              reference: generatePaymentReference("EST"),
              concept: "ESTANCIA",
              status: isPagado ? "PAGADO" : "PENDIENTE",
              payment_type: "COMPLETO",
              created_by: user?.id ?? null,
              shift_session_id: currentShiftId,
              employee_id: currentEmployeeId,
            })
            .select("id")
            .single();

          if (mainError) {
            console.error("Error inserting main payment:", mainError);
          } else if (mainPayment) {
            // Crear subpagos (pagos parciales) vinculados al cargo principal
            const subpayments = validPayments.map(p => ({
              sales_order_id: salesOrder.id,
              amount: p.amount,
              payment_method: p.method,
              reference: p.reference || generatePaymentReference("SUB"),
              concept: "ESTANCIA",
              status: "PAGADO",
              payment_type: "PARCIAL",
              parent_payment_id: mainPayment.id,
              created_by: user?.id ?? null,
              shift_session_id: currentShiftId,
              employee_id: currentEmployeeId,
              terminal_code: p.method === "TARJETA" ? p.terminal : null,
              card_last_4: p.method === "TARJETA" ? p.cardLast4 : null,
              card_type: p.method === "TARJETA" ? p.cardType : null,
            }));

            const { error: subError } = await supabase
              .from("payments")
              .insert(subpayments);

            if (subError) {
              console.error("Error inserting subpayments:", subError);
            }
          }
        } else if (validPayments.length === 1) {
          // PAGO ÚNICO: Un solo registro sin subpagos
          const p = validPayments[0];
          const { error: paymentsError } = await supabase
            .from("payments")
            .insert({
              sales_order_id: salesOrder.id,
              amount: p.amount,
              payment_method: p.method,
              reference: p.reference || generatePaymentReference("EST"),
              concept: "ESTANCIA",
              status: "PAGADO",
              payment_type: "COMPLETO",
              created_by: user?.id ?? null,
              shift_session_id: currentShiftId,
              employee_id: currentEmployeeId,
              terminal_code: p.method === "TARJETA" ? p.terminal : null,
              card_last_4: p.method === "TARJETA" ? p.cardLast4 : null,
              card_type: p.method === "TARJETA" ? p.cardType : null,
            });

          if (paymentsError) {
            console.error("Error inserting payment:", paymentsError);
          }
        }
      }

      // Registrar la estancia de habitación con personas iniciales      // Crear registro de estancia vinculado al turno
      const { data: stayData, error: stayError } = await supabase
        .from("room_stays")
        .insert({
          room_id: selectedRoom.id,
          sales_order_id: salesOrder.id,
          check_in_at: now.toISOString(),
          expected_check_out_at: expectedCheckout.toISOString(),
          status: "ACTIVA",
          current_people: initialPeople,
          total_people: initialPeople,
          vehicle_plate: vehicle.plate || null,
          vehicle_brand: vehicle.brand || null,
          vehicle_model: vehicle.model || null,
          valet_employee_id: null,
          checkout_valet_employee_id: null,
          guest_access_token: crypto.randomUUID(), // Generar token único para el portal
          shift_session_id: currentShiftId
        })
        .select()
        .single();

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

      // FIX #4: Notificar a todos los cocheros (VALETS) usando helper
      await notifyValetsOfNewEntry(supabase, selectedRoom.number, selectedRoom.id, stayData.id);

      // Imprimir ticket de entrada
      try {
        const printData: ConsumptionTicketData = {
          roomNumber: selectedRoom.number,
          folio: `ENT-${selectedRoom.number}`,
          date: new Date(),
          items: [
            { name: `Renta Habitación ${roomType.name}`, qty: 1, price: basePrice, total: basePrice },
            ...(extraPeopleCount > 0 ? [{ name: `Personas Extra (${extraPeopleCount})`, qty: extraPeopleCount, price: extraPersonPrice, total: extraPeopleCost }] : [])
          ],
          subtotal: totalPrice,
          total: totalPrice,
          entranceValet: vehicle.plate ? 'Solicitado' : undefined
        };
        // printConsumptionTickets(printData); // DESHABILITADO POR SOLICITUD
      } catch (e) {
        console.error("Error printing entry ticket", e);
      }

      toast.success("Estancia iniciada", {
        description: `Hab. ${selectedRoom.number} - ${roomType.name} (${initialPeople} persona${initialPeople > 1 ? 's' : ''}) hasta ${formatDateTime(
          expectedCheckout
        )}${extraPeopleCost > 0 ? ` - Total: $${totalPrice.toFixed(2)}` : ''}`,
      });

      setShowStartStayModal(false);
      setSelectedRoom(null);
      await fetchRooms(true);
    } catch (error) {
      console.error("Error starting stay:", error);
      toast.error("Error al iniciar la estancia", {
        description: "Ocurrió un error inesperado. Intenta nuevamente.",
      });
    } finally {
      setStartStayLoading(false);
    }
  };

  // Entrada rápida sin pago (para cuando el cochero aún no llega con el dinero)
  const handleQuickCheckin = async (data: {
    initialPeople: number;
    actualEntryTime: Date;
  }) => {
    if (!selectedRoom || !selectedRoom.room_types) return;

    const isAuthed = await ensureAuthenticated();
    if (!isAuthed) return;

    const pendingBacklog = getPendingPaymentBacklogCount();
    if (pendingBacklog >= MAX_PENDING_QUICK_CHECKINS) {
      toast.error("No se puede registrar Entrada Rápida", {
        description: `Hay ${pendingBacklog} habitaciones con cobro pendiente. Cobra alguna para liberar al cochero.`,
      });
      return;
    }

    setStartStayLoading(true);
    const supabase = createClient();

    try {
      const roomType = selectedRoom.room_types;
      const entryTime = data.actualEntryTime;

      // Calcular hora de salida basada en la hora REAL de entrada
      // Determinar si estamos en período de fin de semana (Viernes 6am - Domingo 6am)
      const day = entryTime.getDay();
      const hour = entryTime.getHours();
      let isWeekendPeriod = false;

      if (day === 5 && hour >= 6) {
        isWeekendPeriod = true;
      } else if (day === 6) {
        isWeekendPeriod = true;
      } else if (day === 0 && hour < 6) {
        isWeekendPeriod = true;
      }

      const hours = isWeekendPeriod
        ? (roomType.weekend_hours ?? 4)
        : (roomType.weekday_hours ?? 4);
      const expectedCheckout = new Date(entryTime);
      expectedCheckout.setHours(expectedCheckout.getHours() + hours);

      const basePrice = roomType.base_price ?? 0;
      const extraPersonPrice = roomType.extra_person_price ?? 0;
      const extraPeopleCount = Math.max(0, data.initialPeople - 2);
      const extraPeopleCost = extraPeopleCount * extraPersonPrice;
      const totalPrice = basePrice + extraPeopleCost;

      // Obtener almacén de recepción
      const { data: defaultWarehouse, error: warehouseError } = await supabase
        .from("warehouses")
        .select("id, code, is_active")
        .eq("code", "ALM002-R")
        .eq("is_active", true)
        .single();

      if (warehouseError || !defaultWarehouse) {
        toast.error("No se encontró el almacén de recepción");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Obtener turno actual y employee_id
      const currentShiftId = await getCurrentShiftId(supabase);
      const currentEmployeeId = await getCurrentEmployeeId(supabase);

      // Crear orden de venta con pago PENDIENTE
      const { data: salesOrder, error: orderError } = await supabase
        .from("sales_orders")
        .insert({
          customer_id: null,
          warehouse_id: defaultWarehouse.id,
          currency: "MXN",
          notes: `⚡ ENTRADA RÁPIDA - Hab. ${selectedRoom.number} ${roomType.name}${extraPeopleCount > 0 ? ` (+${extraPeopleCount} extra)` : ''} - PAGO PENDIENTE`,
          subtotal: totalPrice,
          tax: 0,
          total: totalPrice,
          status: "OPEN",
          remaining_amount: totalPrice, // Todo pendiente
          paid_amount: 0,
          created_by: user?.id ?? null,
          shift_session_id: currentShiftId
        })
        .select("id")
        .single();

      if (orderError) {
        console.error("Error creating sales order:", orderError);
        toast.error("Error al iniciar la estancia");
        return;
      }

      // Buscar o crear producto de servicio
      let serviceProductId: string | null = null;
      const { data: serviceProducts } = await supabase
        .from("products")
        .select("id")
        .eq("sku", "SVC-ROOM")
        .limit(1);

      if (serviceProducts && serviceProducts.length > 0) {
        serviceProductId = serviceProducts[0].id;
      }

      // Insertar items de la orden (todos sin pagar)
      if (serviceProductId) {
        const orderItems = [];

        // Item de habitación base
        orderItems.push({
          sales_order_id: salesOrder.id,
          product_id: serviceProductId,
          qty: 1,
          unit_price: basePrice,
          concept_type: "ROOM_BASE",
          is_paid: false,
          paid_at: null,
          payment_method: null,
        });

        // Items de personas extra
        if (extraPeopleCount > 0 && extraPersonPrice > 0) {
          for (let i = 0; i < extraPeopleCount; i++) {
            orderItems.push({
              sales_order_id: salesOrder.id,
              product_id: serviceProductId,
              qty: 1,
              unit_price: extraPersonPrice,
              concept_type: "EXTRA_PERSON",
              is_paid: false,
              paid_at: null,
              payment_method: null,
            });
          }
        }

        await supabase.from("sales_order_items").insert(orderItems);
      }

      // Crear pago pendiente (para que aparezca en el cobro granular)
      await supabase.from("payments").insert({
        sales_order_id: salesOrder.id,
        amount: totalPrice,
        payment_method: "PENDIENTE",
        reference: generatePaymentReference("QCK"),
        concept: "ESTANCIA",
        status: "PENDIENTE",
        payment_type: "COMPLETO",
        created_by: user?.id ?? null,
        shift_session_id: currentShiftId,
        employee_id: currentEmployeeId,
      });

      // Registrar la estancia con la hora REAL de entrada
      const { data: stayData, error: stayError } = await supabase.from("room_stays").insert({
        room_id: selectedRoom.id,
        sales_order_id: salesOrder.id,
        check_in_at: entryTime.toISOString(), // Hora real de entrada
        expected_check_out_at: expectedCheckout.toISOString(),
        current_people: data.initialPeople,
        total_people: data.initialPeople,
        vehicle_plate: null,
        vehicle_brand: null,
        vehicle_model: null,
        valet_employee_id: null,
        shift_session_id: currentShiftId
      })
        .select()
        .single();

      if (stayError || !stayData) {
        console.error("Error creating room stay:", stayError);
        toast.error("Error al registrar la estancia");
        return;
      }

      // Actualizar estado de la habitación a OCUPADA
      await supabase
        .from("rooms")
        .update({ status: "OCUPADA" })
        .eq("id", selectedRoom.id);

      // FIX #4: Notificar a valets también en quick check-in
      await notifyValetsOfNewEntry(supabase, selectedRoom.number, selectedRoom.id, stayData.id);

      const timeDiff = Math.round((new Date().getTime() - entryTime.getTime()) / 60000);

      toast.success("⚡ Entrada rápida registrada", {
        description: `Hab. ${selectedRoom.number} - Entrada: ${entryTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}${timeDiff > 0 ? ` (hace ${timeDiff} min)` : ''} - PAGO PENDIENTE: $${totalPrice.toFixed(2)}`,
      });

      setShowQuickCheckinModal(false);
      setSelectedRoom(null);
      await fetchRooms(true);
    } catch (error) {
      console.error("Error in quick checkin:", error);
      toast.error("Error al registrar la entrada rápida");
    } finally {
      setStartStayLoading(false);
    }
  };

  const renderStatusBadge = (status: string, isSaliendo: boolean = false) => {
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Tablero de Habitaciones</h1>
          <p className="text-muted-foreground text-sm hidden sm:block">
            Vista general de todas las habitaciones.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            setIsRefreshing(true);
            await fetchRooms(true);
            setTimeout(() => setIsRefreshing(false), 500);
          }}
          disabled={isRefreshing}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          <span className="hidden sm:inline">{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
          <span className="sm:hidden">{isRefreshing ? '...' : 'Sync'}</span>
        </Button>
      </div>

      {/* Reloj global - solo visible en tablero de habitaciones */}
      <GlobalClock />

      {/* Mini-dashboard de contadores por estado */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-blue-500/20 bg-blue-500/5 shadow-sm">
          <CardContent className="py-3 px-4 flex flex-col gap-1 items-center justify-center text-center">
            <span className="text-xs font-medium text-blue-500 uppercase tracking-wider">Libres</span>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {rooms.filter((r) => r.status === "LIBRE").length}
            </span>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5 shadow-sm">
          <CardContent className="py-3 px-4 flex flex-col gap-1 items-center justify-center text-center">
            <span className="text-xs font-medium text-red-500 uppercase tracking-wider">Ocupadas</span>
            <span className="text-2xl font-bold text-red-600 dark:text-red-400">
              {rooms.filter((r) => r.status === "OCUPADA").length}
            </span>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20 bg-purple-500/5 shadow-sm">
          <CardContent className="py-3 px-4 flex flex-col gap-1 items-center justify-center text-center">
            <span className="text-xs font-medium text-purple-500 uppercase tracking-wider">Sucias</span>
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {rooms.filter((r) => r.status === "SUCIA").length}
            </span>
          </CardContent>
        </Card>
        <Card className="border-green-500/20 bg-green-500/5 shadow-sm">
          <CardContent className="py-3 px-4 flex flex-col gap-1 items-center justify-center text-center">
            <span className="text-xs font-medium text-green-500 uppercase tracking-wider">Bloqueadas</span>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {rooms.filter((r) => r.status === "BLOQUEADA").length}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Leyenda de estados y tipos - Responsive Fix */}
      <div className="flex flex-col gap-4">
        <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
          <div className="flex flex-wrap gap-x-8 gap-y-3 justify-center text-xs text-muted-foreground">
            {/* Estados */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-foreground/80">Estados:</span>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
                <span>Libre</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
                <span>Ocupada</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm" />
                <span>Sucia</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" />
                <span>Bloqueada</span>
              </div>
            </div>

            <div className="w-px h-4 bg-border hidden sm:block" />

            {/* Tipos de habitación */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-foreground/80">Tipos:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-500 text-white shadow-sm">SEN</span>
                <span>Sencilla</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-600 text-white shadow-sm">J&S</span>
                <span>Jacuzzi y Sauna</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-pink-500 text-white shadow-sm">JAC</span>
                <span>Jacuzzi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-600 text-white shadow-sm">ALB</span>
                <span>Alberca</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-500 text-white shadow-sm">TRE</span>
                <span>Torre</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Botones de prueba para alertas - ELIMINAR EN PRODUCCIÓN */}
      <div className="flex gap-2 justify-end sm:ml-auto">
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
          onClick={() => setReminderAlert({ roomNumber: "101", minutes: 18, level: "20" })}
        >
          Test Alerta 20min
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] border-red-500/50 text-red-400 hover:bg-red-500/20"
          onClick={() => setReminderAlert({ roomNumber: "102", minutes: 3, level: "5" })}
        >
          Test Alerta 5min
        </Button>
      </div>


      {/* Grid único de habitaciones */}
      <Card>
        <CardContent className="pt-4">
          <div id="tour-room-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3 min-h-[50vh]">
            {rooms.map((room) => {
              const status = room.status || "OTRO";
              const timeInfo = getRemainingTimeLabel(room);
              const isSaliendo = !!timeInfo?.isSaliendo;

              // Verificar si tiene pago pendiente (remaining_amount > 0 en habitación ocupada)
              const activeStay = getActiveStay(room);
              const hasPendingPayment = status === "OCUPADA" &&
                activeStay?.sales_orders &&
                (activeStay.sales_orders.remaining_amount || 0) > 0;

              // Obtener información del vehículo si existe estancia activa
              const vehicleStatus = {
                hasVehicle: !!activeStay?.vehicle_plate,
                isReady: !!activeStay?.checkout_valet_employee_id,
                plate: activeStay?.vehicle_plate || undefined,
                isWaitingAuthorization: !!activeStay?.valet_checkout_requested_at && !activeStay?.vehicle_requested_at
              };

              return (
                <RoomCard
                  key={room.id}
                  id={room.id}
                  number={room.number}
                  status={status}
                  bgClass={isSaliendo ? "bg-orange-900/80" : ROOM_STATUS_BG[status]}
                  accentClass={isSaliendo ? "ring-1 ring-orange-500/40" : ROOM_STATUS_ACCENT[status]}
                  statusBadge={renderStatusBadge(status, isSaliendo)}
                  hasPendingPayment={!!hasPendingPayment}
                  roomTypeName={room.room_types?.name}
                  notes={room.notes}
                  sensorStatus={(() => {
                    const s = sensors.find(sen => sen.room_id === room.id);
                    if (!s) return null;
                    return { isOpen: s.is_open, batteryLevel: s.battery_level, isOnline: s.status === 'ONLINE' };
                  })()}
                  vehicleStatus={activeStay ? vehicleStatus : null}
                  onInfo={() => {
                    setSelectedRoom(room);
                    setShowInfoModal(true);
                  }}
                  onActions={() => openActionsDock(room)}
                  data-tutorial="room-card"
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
        isOpen={showCheckoutModal && !!selectedRoom}
        roomNumber={selectedRoom?.number || ""}
        roomTypeName={selectedRoom?.room_types?.name || ""}
        remainingAmount={checkoutInfo?.remainingAmount || 0}
        checkoutAmount={checkoutAmount}
        actionLoading={actionLoading}
        pendingItems={checkoutInfo?.pendingItems}
        onAmountChange={setCheckoutAmount}
        onClose={() => {
          setShowCheckoutModal(false);
          setCheckoutInfo(null);
        }}
        onRequestValet={async () => {
          if (selectedRoom) {
            const activeStay = getActiveStay(selectedRoom);
            if (activeStay) {
              await requestVehicle(activeStay.id);
              setShowCheckoutModal(false);
              toast.success("Solicitud enviada al cochero");
            }
          }
        }}
        onConfirm={handleCheckout}
        defaultValetId={selectedRoom ? getActiveStay(selectedRoom)?.checkout_valet_employee_id : null}
        vehiclePlate={selectedRoom ? getActiveStay(selectedRoom)?.vehicle_plate || null : null}
        checkoutPaymentData={(() => {
          const data = selectedRoom ? getActiveStay(selectedRoom)?.checkout_payment_data : undefined;
          if (showCheckoutModal) console.log("🏨 [Board] Passing payment data:", data);
          return data || undefined;
        })()}
      />
      <RoomActionsWheel
        room={selectedRoom}
        isOpen={showActionsModal}
        isVisible={actionsDockVisible}
        actionLoading={actionLoading}
        hasPendingValetPayment={hasPendingValetPayment}
        statusBadge={selectedRoom ? renderStatusBadge(selectedRoom.status) : null}
        hasExtraCharges={selectedRoom ? hasExtraCharges(selectedRoom) : false}
        isHotelRoom={selectedRoom?.room_types?.is_hotel === true}
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
        onPayExtra={() => {
          if (selectedRoom) {
            openPayExtraModal(selectedRoom);
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
        onViewDetails={() => {
          if (selectedRoom) {
            setShowActionsModal(false);
            setShowDetailsModal(true);
          }
        }}
        onGranularPayment={() => {
          if (selectedRoom) {
            openGranularPaymentModal(selectedRoom);
            setShowActionsModal(false);
          }
        }}
        onAddProduct={() => {
          if (selectedRoom) {
            openConsumptionModal(selectedRoom);
            setShowActionsModal(false);
          }
        }}
        onAddPerson={() => {
          if (selectedRoom) {
            setShowManagePeopleModal(true);
            setShowActionsModal(false);
          }
        }}
        onRemovePerson={() => {
          if (selectedRoom) handleRemovePerson(selectedRoom);
        }}
        onPersonLeftReturning={() => {
          if (selectedRoom) handlePersonLeftReturning(selectedRoom);
        }}
        onAddHour={() => {
          setShowActionsModal(false);
          setShowHourManagementModal(true);
        }}
        onMarkClean={() => selectedRoom && updateRoomStatus(selectedRoom, "LIBRE", "Habitación limpia")}
        onBlock={() => {
          const room = selectedRoom;
          closeActionsDock();
          setTimeout(() => {
            if (room) handleOpenBlockModal(room);
          }, 200);
        }}
        onUnblock={() => selectedRoom && updateRoomStatus(selectedRoom, "LIBRE", "Habitación desbloqueada")}
        onMarkDirty={() => {
          const room = selectedRoom;
          closeActionsDock();
          setTimeout(() => {
            if (room) handleOpenDirtyModal(room);
          }, 200);
        }}
        onQuickCheckin={() => {
          const pendingBacklog = getPendingPaymentBacklogCount();
          if (pendingBacklog >= MAX_PENDING_QUICK_CHECKINS) {
            toast.error("Entrada Rápida temporalmente bloqueada", {
              description: `Hay ${pendingBacklog} habitaciones con cobro pendiente. Cobra alguna para poder registrar nuevas entradas.`,
            });
            closeActionsDock();
            return;
          }

          setShowActionsModal(false);
          setShowQuickCheckinModal(true);
        }}
        onEditVehicle={() => {
          setShowActionsModal(false);
          setShowEditVehicleModal(true);
        }}
        onEditValet={() => {
          setShowActionsModal(false);
          setShowEditValetModal(true);
        }}
        onChangeRoom={() => {
          setShowActionsModal(false);
          setShowChangeRoomModal(true);
        }}
        onCancelStay={() => {
          setShowActionsModal(false);
          setShowCancelStayModal(true);
        }}
        onManagePeople={() => {
          setShowActionsModal(false);
          setShowManagePeopleModal(true);
        }}
        onShowGuestPortal={() => {
          setShowGuestPortalQRModal(true);
        }}
        onRequestVehicle={async () => {
          if (selectedRoom) {
            const activeStay = getActiveStay(selectedRoom);
            if (activeStay) {
              await requestVehicle(activeStay.id);
              setShowActionsModal(false);
            }
          }
        }}
        onAddDamageCharge={() => {
          if (selectedRoom) setShowDamageModal(true);
        }}
        onNotifyCheckout={handleNotifyCheckout}

        isValet={isValet}
        hasValetAssigned={selectedRoom ? !!getActiveStay(selectedRoom)?.valet_employee_id : false}
        hasVehicleRegistered={selectedRoom ? !!getActiveStay(selectedRoom)?.vehicle_plate : false}
        hasValetCheckoutRequest={selectedRoom ? (!!getActiveStay(selectedRoom)?.valet_checkout_requested_at && !getActiveStay(selectedRoom)?.vehicle_requested_at) : false}
        onAuthorizeValetCheckout={async () => {
          if (selectedRoom) {
            await handleAuthorizeValetCheckout(selectedRoom);
            setShowActionsModal(false);
          }
        }}
        onViewServices={() => {
          setShowActionsModal(false);
          setShowTrackingModal(true);
        }}
      />
      <RoomPayExtraModal
        isOpen={showPayExtraModal && !!selectedRoom && !!payExtraInfo}
        roomNumber={selectedRoom?.number || ""}
        roomTypeName={selectedRoom?.room_types?.name || ""}
        extraAmount={payExtraInfo?.extraAmount || 0}
        payAmount={payExtraAmount}
        actionLoading={actionLoading}
        onAmountChange={setPayExtraAmount}
        onClose={handleClosePayExtraModal}
        onConfirm={handlePayExtra}
      />
      <RoomReminderAlert
        isOpen={!!reminderAlert}
        roomNumber={reminderAlert?.roomNumber || ""}
        minutes={reminderAlert?.minutes || 0}
        level={reminderAlert?.level || "20"}
        onClose={() => setReminderAlert(null)}
      />
      <RoomDetailsModal
        isOpen={showDetailsModal && !!selectedRoom}
        room={selectedRoom}
        activeStay={selectedRoom ? getActiveStay(selectedRoom) : null}
        employeeId={employeeId}
        onClose={() => {
          setShowDetailsModal(false);
        }}
      />
      <ConsumptionTrackingModal
        isOpen={showTrackingModal && !!selectedRoom}
        salesOrderId={selectedRoom ? getActiveStay(selectedRoom)?.sales_order_id || null : null}
        roomNumber={selectedRoom?.number || ""}
        receptionistId={employeeId || ""}
        onClose={() => setShowTrackingModal(false)}
      />
      <GranularPaymentModal
        isOpen={showGranularPaymentModal && !!granularPaymentOrderId}
        salesOrderId={granularPaymentOrderId || ""}
        roomNumber={selectedRoom?.number}
        onClose={handleCloseGranularPaymentModal}
        onComplete={handleGranularPaymentComplete}
      />
      <AddConsumptionModal
        isOpen={showConsumptionModal && !!consumptionOrderId}
        salesOrderId={consumptionOrderId || ""}
        roomNumber={selectedRoom?.number}
        onClose={handleCloseConsumptionModal}
        onComplete={handleConsumptionComplete}
      />
      <QuickCheckinModal
        isOpen={showQuickCheckinModal && !!selectedRoom}
        roomNumber={selectedRoom?.number || ""}
        roomType={selectedRoom?.room_types || { id: "", name: "", base_price: 0 }}
        actionLoading={startStayLoading}
        onClose={() => {
          setShowQuickCheckinModal(false);
          setSelectedRoom(null);
        }}
        onConfirm={handleQuickCheckin}
      />
      <EditVehicleModal
        isOpen={showEditVehicleModal && !!selectedRoom}
        roomNumber={selectedRoom?.number || ""}
        currentVehicle={{
          plate: selectedRoom ? getActiveStay(selectedRoom)?.vehicle_plate || null : null,
          brand: selectedRoom ? getActiveStay(selectedRoom)?.vehicle_brand || null : null,
          model: selectedRoom ? getActiveStay(selectedRoom)?.vehicle_model || null : null,
        }}
        actionLoading={actionLoading}
        onClose={() => {
          setShowEditVehicleModal(false);
        }}
        onSave={async (vehicle) => {
          if (!selectedRoom) return;
          const activeStay = getActiveStay(selectedRoom);
          if (!activeStay) {
            toast.error("No se encontró una estancia activa");
            return;
          }

          const supabase = createClient();
          const { error } = await supabase
            .from("room_stays")
            .update({
              vehicle_plate: vehicle.plate.trim() || null,
              vehicle_brand: vehicle.brand.trim() || null,
              vehicle_model: vehicle.model.trim() || null,
            })
            .eq("id", activeStay.id);

          if (error) {
            console.error("Error updating vehicle:", error);
            toast.error("Error al actualizar datos del vehículo");
            return;
          }

          toast.success("Vehículo actualizado", {
            description: vehicle.plate ? `Placas: ${vehicle.plate}` : "Datos guardados",
          });
          setShowEditVehicleModal(false);
          await fetchRooms(true);
        }}
      />
      <EditValetModal
        isOpen={showEditValetModal && !!selectedRoom}
        roomNumber={selectedRoom?.number || ""}
        currentValetId={selectedRoom ? getActiveStay(selectedRoom)?.valet_employee_id || null : null}
        stayId={selectedRoom ? (getActiveStay(selectedRoom)?.id || "") : ""}
        onClose={() => {
          setShowEditValetModal(false);
        }}
        onSuccess={async () => {
          toast.success("Cochero actualizado");
          setShowEditValetModal(false);
          await fetchRooms(true);
        }}
      />
      <ChangeRoomModal
        isOpen={showChangeRoomModal && !!selectedRoom}
        currentRoom={selectedRoom}
        currentStay={selectedRoom ? (() => {
          const stay = getActiveStay(selectedRoom);
          if (!stay) return null;
          return {
            id: stay.id,
            check_in_at: stay.check_in_at || new Date().toISOString(),
            expected_check_out_at: stay.expected_check_out_at || new Date().toISOString(),
            current_people: stay.current_people || 2,
            vehicle_plate: stay.vehicle_plate,
            vehicle_brand: stay.vehicle_brand,
            vehicle_model: stay.vehicle_model,
            sales_order_id: stay.sales_order_id,
          };
        })() : null}
        availableRooms={rooms.filter(r => r.status === "LIBRE")}
        actionLoading={actionLoading}
        onClose={() => setShowChangeRoomModal(false)}
        onConfirm={async (data) => {
          if (!selectedRoom) return;
          const activeStay = getActiveStay(selectedRoom);
          if (!activeStay) return;

          setStartStayLoading(true);
          const supabase = createClient();

          try {
            const newRoom = rooms.find(r => r.id === data.newRoomId);
            if (!newRoom) throw new Error("Habitación no encontrada");

            // Calcular nueva hora de salida
            let newExpectedCheckout: string;
            if (data.keepTime) {
              // Mantener la hora de salida original
              newExpectedCheckout = activeStay.expected_check_out_at || new Date().toISOString();
            } else {
              // Reiniciar tiempo desde ahora
              const now = new Date();
              const roomType = newRoom.room_types;

              // Determinar si estamos en período de fin de semana (Viernes 6am - Domingo 6am)
              const day = now.getDay();
              const hour = now.getHours();
              let isWeekendPeriod = false;

              if (day === 5 && hour >= 6) {
                isWeekendPeriod = true;
              } else if (day === 6) {
                isWeekendPeriod = true;
              } else if (day === 0 && hour < 6) {
                isWeekendPeriod = true;
              }

              const hours = isWeekendPeriod ? (roomType?.weekend_hours ?? 4) : (roomType?.weekday_hours ?? 4);
              const checkout = new Date(now);
              checkout.setHours(checkout.getHours() + hours);
              newExpectedCheckout = checkout.toISOString();
            }

            // Actualizar la estancia con la nueva habitación
            const { error: stayError } = await supabase
              .from("room_stays")
              .update({
                room_id: data.newRoomId,
                expected_check_out_at: newExpectedCheckout,
                ...(data.keepTime ? {} : { check_in_at: new Date().toISOString() }),
              })
              .eq("id", activeStay.id);

            if (stayError) throw stayError;

            // Marcar habitación original como SUCIA
            await supabase
              .from("rooms")
              .update({ status: "SUCIA" })
              .eq("id", selectedRoom.id);

            // Marcar nueva habitación como OCUPADA
            await supabase
              .from("rooms")
              .update({ status: "OCUPADA" })
              .eq("id", data.newRoomId);

            // 1. Calcular diferencia de precio (positivo = cobro, negativo = devolución)
            const oldPrice = selectedRoom.room_types?.base_price || 0;
            const newPrice = newRoom.room_types?.base_price || 0;
            const priceDifference = newPrice - oldPrice; // Positivo = upgrade, Negativo = downgrade

            console.log("[RoomChange] Price check:", { oldPrice, newPrice, priceDifference });

            // 2. Si hay diferencia de precio (en cualquier dirección), crear item para verificación del cochero
            if (priceDifference !== 0) {
              // Buscar producto de servicio para el item
              const { data: svcProducts, error: svcError } = await supabase
                .from("products")
                .select("id")
                .eq("sku", "SVC-ROOM")
                .limit(1);

              console.log("[RoomChange] SVC-ROOM product:", { svcProducts, svcError });

              const svcProductId = svcProducts?.[0]?.id;

              if (svcProductId) {
                const isRefund = priceDifference < 0;
                const absAmount = Math.abs(priceDifference);

                // Insertar Item de Diferencia con PENDING_VALET para que el cochero lo verifique
                // NOTA: 'total' es columna GENERATED, 'description' no existe
                const { data: insertedItem, error: insertError } = await supabase.from("sales_order_items").insert({
                  sales_order_id: activeStay.sales_order_id,
                  product_id: svcProductId,
                  qty: 1,
                  unit_price: absAmount,
                  concept_type: "ROOM_CHANGE_ADJUSTMENT",
                  delivery_notes: isRefund
                    ? `Devolución por cambio: Hab ${selectedRoom.number} → ${newRoom.number}`
                    : `Cargo por cambio: Hab ${selectedRoom.number} → ${newRoom.number}`,
                  is_paid: false,
                  delivery_status: "PENDING_VALET",
                  issue_description: JSON.stringify({
                    oldRoomNumber: selectedRoom.number,
                    newRoomNumber: newRoom.number,
                    oldRoomType: selectedRoom.room_types?.name || "---",
                    newRoomType: newRoom.room_types?.name || "---",
                    isRefund: isRefund,
                    amount: absAmount
                  })
                }).select('id').single();

                console.log("[RoomChange] Insert result:", { insertedItem, insertError });

                if (insertError) {
                  console.error("Error inserting ROOM_CHANGE_ADJUSTMENT:", insertError);
                }

                const roomChangeItemId = insertedItem?.id;

                // Solo actualizar totales de la orden si es un cobro (upgrade)
                // Las devoluciones no afectan el total hasta que el cochero las confirme
                if (!isRefund) {
                  const { data: currentOrder } = await supabase
                    .from("sales_orders")
                    .select("subtotal, total, remaining_amount")
                    .eq("id", activeStay.sales_order_id)
                    .single();

                  if (currentOrder) {
                    await supabase
                      .from("sales_orders")
                      .update({
                        subtotal: (currentOrder.subtotal || 0) + absAmount,
                        total: (currentOrder.total || 0) + absAmount,
                        remaining_amount: (currentOrder.remaining_amount || 0) + absAmount
                      })
                      .eq("id", activeStay.sales_order_id);
                  }
                }

                // Notificación estandarizada a valets activos (dentro del bloque para incluir itemId)
                await notifyActiveValets(
                  supabase,
                  '🔀 Cambio de Habitación',
                  isRefund
                    ? `Hab ${selectedRoom.number} ➡ ${newRoom.number}. Entregar devolución: $${absAmount}`
                    : `Hab ${selectedRoom.number} ➡ ${newRoom.number}. Cobrar diferencia: $${absAmount}`,
                  {
                    type: 'ROOM_CHANGE',
                    oldRoomNumber: selectedRoom.number,
                    newRoomNumber: newRoom.number,
                    stayId: activeStay.id,
                    consumptionId: roomChangeItemId,
                    salesOrderId: activeStay.sales_order_id
                  }
                );
              } else {
                // No hay diferencia de precio, pero aún así notificar el cambio
                await notifyActiveValets(
                  supabase,
                  '🔀 Cambio de Habitación',
                  `Habitación ${selectedRoom.number} ➡ ${newRoom.number}. Por favor mover vehículo.`,
                  {
                    type: 'ROOM_CHANGE',
                    oldRoomNumber: selectedRoom.number,
                    newRoomNumber: newRoom.number,
                    stayId: activeStay.id
                  }
                );
              }
            } else {
              // No hay diferencia de precio, solo notificar el cambio
              await notifyActiveValets(
                supabase,
                '🔀 Cambio de Habitación',
                `Habitación ${selectedRoom.number} ➡ ${newRoom.number}. Por favor mover vehículo.`,
                {
                  type: 'ROOM_CHANGE',
                  oldRoomNumber: selectedRoom.number,
                  newRoomNumber: newRoom.number,
                  stayId: activeStay.id
                }
              );
            }

            // Actualizar notas de la orden con el motivo del cambio
            const { data: orderData } = await supabase
              .from("sales_orders")
              .select("notes")
              .eq("id", activeStay.sales_order_id)
              .single();

            const chargeNote = priceDifference !== 0
              ? (priceDifference > 0 ? ` (Cobro pendiente: $${priceDifference.toFixed(2)})` : ` (Devolución pendiente: $${Math.abs(priceDifference).toFixed(2)})`)
              : "";
            const newNotes = `${orderData?.notes || ""}\n📝 CAMBIO: Hab. ${selectedRoom.number} → ${newRoom.number} (${data.keepTime ? "tiempo mantenido" : "tiempo reiniciado"}). Motivo: ${data.reason}${chargeNote}`;

            await supabase
              .from("sales_orders")
              .update({ notes: newNotes.trim() })
              .eq("id", activeStay.sales_order_id);

            toast.success("Habitación cambiada", {
              description: `${selectedRoom.number} → ${newRoom.number} (${data.keepTime ? "tiempo mantenido" : "tiempo reiniciado"})`,
            });

            setShowChangeRoomModal(false);
            setSelectedRoom(null);
            await fetchRooms(true);
          } catch (error) {
            console.error("Error changing room:", error);
            toast.error("Error al cambiar habitación");
          } finally {
            setStartStayLoading(false);
          }
        }}
      />
      <CancelStayModal
        isOpen={showCancelStayModal && !!selectedRoom}
        salesOrderId={selectedRoom ? getActiveStay(selectedRoom)?.sales_order_id || "" : ""}
        roomNumber={selectedRoom?.number || ""}
        roomTypeName={selectedRoom?.room_types?.name || ""}
        elapsedMinutes={(() => {
          if (!selectedRoom) return 0;
          const stay = getActiveStay(selectedRoom);
          if (!stay?.check_in_at) return 0;
          const checkIn = new Date(stay.check_in_at);
          return Math.floor((new Date().getTime() - checkIn.getTime()) / 60000);
        })()}
        actionLoading={actionLoading}
        onClose={() => setShowCancelStayModal(false)}
        onConfirm={async (data) => {
          if (!selectedRoom) return;
          const activeStay = getActiveStay(selectedRoom);
          if (!activeStay) return;

          setStartStayLoading(true);
          const supabase = createClient();

          try {
            // Finalizar la estancia como CANCELADA
            await supabase
              .from("room_stays")
              .update({
                status: "CANCELADA",
                actual_check_out_at: new Date().toISOString(),
              })
              .eq("id", activeStay.id);

            // Marcar habitación como SUCIA
            await supabase
              .from("rooms")
              .update({ status: "SUCIA" })
              .eq("id", selectedRoom.id);

            // Calcular monto retenido (lo que queda como ingreso real)
            // Se asume que totalPaid está disponible o se puede inferir.
            // Pero CancelStayModal pasa "refundType" y "refundAmount".
            // Para ser precisos, debemos saber cuánto se pagó realmente.
            // Supabase query en modal ya lo sabe, pero aquí en onConfirm solo recibimos `data`.
            // Necesitamos consultar la orden antes de actualizar o confiar en que el usuario no manipula DOM.
            // MEJOR: Recalcular conservadoramente.

            // 1. Obtener datos actuales de la orden
            const { data: currentOrder } = await supabase
              .from("sales_orders")
              .select("paid_amount")
              .eq("id", activeStay.sales_order_id)
              .single();

            const totalPaid = currentOrder?.paid_amount || 0;
            let retainedAmount = 0;

            if (data.refundType === "none") {
              retainedAmount = totalPaid; // Nos quedamos con todo lo pagado
            } else if (data.refundType === "full") {
              retainedAmount = 0; // Devolvemos todo, ingreso 0
            } else if (data.refundType === "partial") {
              retainedAmount = Math.max(0, totalPaid - data.refundAmount);
            }

            // Actualizar orden de venta con los nuevos totales reales
            await supabase
              .from("sales_orders")
              .update({
                status: "CANCELLED",
                subtotal: retainedAmount,
                total: retainedAmount,
                paid_amount: retainedAmount,
                remaining_amount: 0, // Se cancela cualquier deuda pendiente
                notes: `❌ CANCELADA: ${data.reason}. Reembolso: ${data.refundType === "full" ? "Total" : data.refundType === "partial" ? `Parcial $${data.refundAmount}` : "Sin reembolso"} (Retenido: $${retainedAmount})`,
              })
              .eq("id", activeStay.sales_order_id);

            toast.success("Estancia cancelada", {
              description: `Hab. ${selectedRoom.number} - ${data.refundType !== "none" ? `Reembolso: $${data.refundAmount.toFixed(2)}` : "Sin reembolso"}`,
            });

            setShowCancelStayModal(false);
            setSelectedRoom(null);
            await fetchRooms(true);
          } catch (error) {
            console.error("Error cancelling stay:", error);
            toast.error("Error al cancelar estancia");
          } finally {
            setStartStayLoading(false);
          }
        }}
      />
      <ManagePeopleModal
        isOpen={showManagePeopleModal && !!selectedRoom}
        roomNumber={selectedRoom?.number || ""}
        currentPeople={selectedRoom ? (getActiveStay(selectedRoom)?.current_people || 2) : 2}
        totalPeople={selectedRoom ? (getActiveStay(selectedRoom)?.total_people || 2) : 2}
        maxPeople={selectedRoom?.room_types?.max_people || 4}
        hasActiveTolerance={selectedRoom ? !!(getActiveStay(selectedRoom)?.tolerance_started_at) : false}
        toleranceMinutesLeft={(() => {
          if (!selectedRoom) return 0;
          const stay = getActiveStay(selectedRoom);
          if (!stay?.tolerance_started_at) return 0;
          const started = new Date(stay.tolerance_started_at);
          const elapsed = Math.floor((new Date().getTime() - started.getTime()) / 60000);
          return Math.max(0, 60 - elapsed);
        })()}
        extraPersonPrice={selectedRoom?.room_types?.extra_person_price || 0}
        isHotelRoom={selectedRoom?.room_types?.is_hotel || false}
        actionLoading={actionLoading}
        onClose={() => setShowManagePeopleModal(false)}
        onAddPersonNew={() => {
          if (selectedRoom) {
            handleAddPerson(selectedRoom);
            setShowManagePeopleModal(false);
          }
        }}
        onAddPersonReturning={() => {
          if (selectedRoom) {
            handlePersonLeftReturning(selectedRoom);
            setShowManagePeopleModal(false);
          }
        }}
        onRemovePerson={(willReturn) => {
          if (selectedRoom) {
            if (willReturn) {
              handlePersonLeftReturning(selectedRoom);
            } else {
              handleRemovePerson(selectedRoom);
            }
            setShowManagePeopleModal(false);
          }
        }}
      />

      <RoomStatusNoteModal
        isOpen={showStatusNoteModal}
        onClose={() => {
          setShowStatusNoteModal(false);
          setStatusNoteAction(null);
          setSelectedRoom(null);
        }}
        onConfirm={handleConfirmStatusChange}
        title={statusNoteAction === "BLOCK" ? "Bloquear Habitación" : "Marcar como Sucia / Mantenimiento"}
        description={statusNoteAction === "BLOCK"
          ? "Indica el motivo por el cual se bloqueará la habitación."
          : "Indica el motivo de mantenimiento o limpieza especial."}
        confirmLabel={statusNoteAction === "BLOCK" ? "Bloquear" : "Marcar Sucia"}
        loading={actionLoading}
        initialNote={selectedRoom?.notes || ""}
      />

      <RoomHourManagementModal
        isOpen={showHourManagementModal && !!selectedRoom}
        room={selectedRoom}
        actionLoading={actionLoading}
        onClose={() => setShowHourManagementModal(false)}
        onConfirmCustomHours={async (hours, payments, isCourtesy, courtesyReason) => {
          if (selectedRoom) {
            await handleAddCustomHours(selectedRoom, hours, payments, isCourtesy, courtesyReason);
            setShowHourManagementModal(false);
            setShowInfoModal(false); // Cerrar para refrescar tiempo
          }
        }}
        onConfirmRenew={async (payments) => {
          if (selectedRoom) {
            await handleRenewRoom(selectedRoom, payments);
            setShowHourManagementModal(false);
            setShowInfoModal(false); // Cerrar para refrescar tiempo
          }
        }}
        onConfirmPromo4H={async (payments) => {
          if (selectedRoom) {
            await handleAdd4HourPromo(selectedRoom, payments);
            setShowHourManagementModal(false);
            setShowInfoModal(false); // Cerrar para refrescar tiempo
          }
        }}
      />

      <AddDamageChargeModal
        isOpen={showDamageModal && !!selectedRoom}
        room={selectedRoom || null}
        actionLoading={actionLoading}
        onClose={() => setShowDamageModal(false)}
        onConfirm={async (amount, reason) => {
          if (selectedRoom) {
            await handleAddDamageCharge(selectedRoom, amount, reason);
            setShowDamageModal(false);
          }
        }}
      />
      <GuestPortalQRModal
        isOpen={showGuestPortalQRModal && !!selectedRoom}
        onClose={() => setShowGuestPortalQRModal(false)}
        roomNumber={selectedRoom?.number || ""}
        roomStayId={selectedRoom ? (getActiveStay(selectedRoom)?.id || "") : ""}
      />
    </div >
  );
}

// Export wrapper como componente principal
export { RoomsBoardWrapper as RoomsBoard };

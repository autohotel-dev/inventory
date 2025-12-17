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
import { RoomStartStayModal, VehicleInfo } from "@/components/sales/room-start-stay-modal";
import { RoomCheckoutModal } from "@/components/sales/room-checkout-modal";
import { RoomPayExtraModal } from "@/components/sales/room-pay-extra-modal";
import { RoomReminderAlert } from "@/components/sales/room-reminder-alert";
import { RoomDetailsModal } from "@/components/sales/room-details-modal";
import { GranularPaymentModal } from "@/components/sales/granular-payment-modal";
import { AddConsumptionModal } from "@/components/sales/add-consumption-modal";
import { QuickCheckinModal } from "@/components/sales/quick-checkin-modal";
import { EditVehicleModal } from "@/components/sales/edit-vehicle-modal";
import { ChangeRoomModal } from "@/components/sales/change-room-modal";
import { CancelStayModal } from "@/components/sales/cancel-stay-modal";
import { ManagePeopleModal } from "@/components/sales/manage-people-modal";
import {
  Room,
  RoomType,
  STATUS_CONFIG,
  ROOM_STATUS_BG,
  ROOM_STATUS_ACCENT,
} from "@/components/sales/room-types";
import { PaymentEntry } from "@/components/sales/multi-payment-input";

// Generar referencia única para pagos
function generatePaymentReference(prefix: string = "PAY"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}
import { useRoomActions, getActiveStay, isToleranceExpired, getToleranceRemainingMinutes } from "@/hooks/use-room-actions";
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
  const [showQuickCheckinModal, setShowQuickCheckinModal] = useState(false);
  const [showEditVehicleModal, setShowEditVehicleModal] = useState(false);
  const [showChangeRoomModal, setShowChangeRoomModal] = useState(false);
  const [showCancelStayModal, setShowCancelStayModal] = useState(false);
  const [showManagePeopleModal, setShowManagePeopleModal] = useState(false);

  // Actualizar selectedRoom cuando rooms cambie (después de fetchRooms)
  useEffect(() => {
    if (selectedRoom && rooms.length > 0) {
      const updatedRoom = rooms.find(r => r.id === selectedRoom.id);
      if (updatedRoom) {
        setSelectedRoom(updatedRoom);
      }
    }
  }, [rooms]);

  // Función para recargar habitaciones (silent = true para refresh sin parpadeo)
  const fetchRooms = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("rooms")
        .select(
          `id, number, status, room_types:room_type_id ( id, name, base_price, weekday_hours, weekend_hours, is_hotel, extra_person_price, extra_hour_price, max_people ), room_stays ( id, sales_order_id, status, check_in_at, expected_check_out_at, current_people, total_people, tolerance_started_at, tolerance_type, vehicle_plate, vehicle_brand, vehicle_model, sales_orders ( remaining_amount ) )`
        )
        .order("number", { ascending: true });

      if (error) {
        console.error("Error loading rooms:", error);
        if (!silent) setRooms([]);
        return;
      }

      setRooms((data as any) || []);
    } catch (err) {
      console.error("Error fetching rooms:", err);
      if (!silent) setRooms([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Hook de acciones de habitación
  const {
    actionLoading,
    handleAddPerson,
    handleRemovePerson,
    handlePersonLeftReturning,
    handleAddExtraHour,
    updateRoomStatus,
    prepareCheckout,
    processCheckout,
  } = useRoomActions(() => fetchRooms(true));

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
  const handleCheckout = async (payments: PaymentEntry[]) => {
    if (!checkoutInfo || !selectedRoom) return;
    const success = await processCheckout(selectedRoom, checkoutInfo, checkoutAmount, payments);
    if (success) {
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

  // Verificar tolerancias expiradas y cobrar automáticamente (solo motel)
  useEffect(() => {
    const checkTolerances = async () => {
      const supabase = createClient();

      for (const room of rooms) {
        if (room.status !== "OCUPADA") continue;
        if (room.room_types?.is_hotel) continue; // No aplica para hotel/torre

        const activeStay = getActiveStay(room);
        if (!activeStay?.tolerance_started_at || !activeStay.tolerance_type) continue;

        // Verificar si la tolerancia expiró
        if (isToleranceExpired(activeStay.tolerance_started_at)) {
          try {
            let chargeAmount = 0;
            let chargeDescription = "";

            if (activeStay.tolerance_type === 'ROOM_EMPTY') {
              // Cobrar habitación completa
              chargeAmount = room.room_types?.base_price ?? 0;
              chargeDescription = "Tolerancia expirada - Habitación cobrada";
            } else if (activeStay.tolerance_type === 'PERSON_LEFT') {
              // Cobrar persona extra
              chargeAmount = room.room_types?.extra_person_price ?? 0;
              chargeDescription = "Tolerancia expirada - Persona extra cobrada";
            }

            if (chargeAmount > 0) {
              // Actualizar orden de venta
              const { data: orderData } = await supabase
                .from("sales_orders")
                .select("subtotal, tax, paid_amount")
                .eq("id", activeStay.sales_order_id)
                .single();

              if (orderData) {
                const newSubtotal = (Number(orderData.subtotal) || 0) + chargeAmount;
                const newTotal = newSubtotal + (Number(orderData.tax) || 0);
                const newRemaining = Math.max(newTotal - (Number(orderData.paid_amount) || 0), 0);

                await supabase
                  .from("sales_orders")
                  .update({
                    subtotal: newSubtotal,
                    total: newTotal,
                    remaining_amount: newRemaining,
                  })
                  .eq("id", activeStay.sales_order_id);

                toast.warning(chargeDescription, {
                  description: `Hab. ${room.number}: +$${chargeAmount.toFixed(2)} MXN`,
                });
              }
            }

            // Limpiar tolerancia
            await supabase
              .from("room_stays")
              .update({
                tolerance_started_at: null,
                tolerance_type: null,
              })
              .eq("id", activeStay.id);

            // Refrescar datos
            await fetchRooms(true);
          } catch (error) {
            console.error("Error processing expired tolerance:", error);
          }
        }
      }
    };

    // Verificar cada minuto
    const interval = setInterval(checkTolerances, 60000);
    // También verificar al cargar
    checkTolerances();

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

  const handleStartStay = async (initialPeople: number, payments: PaymentEntry[], vehicle: VehicleInfo) => {
    if (!selectedRoom || !selectedRoom.room_types) return;

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
            });

          if (paymentsError) {
            console.error("Error inserting payment:", paymentsError);
          }
        }
      }

      // Registrar la estancia de habitación con personas iniciales y datos del vehículo
      const { error: stayError } = await supabase.from("room_stays").insert({
        room_id: selectedRoom.id,
        sales_order_id: salesOrder.id,
        check_in_at: now.toISOString(),
        expected_check_out_at: expectedCheckout.toISOString(),
        current_people: initialPeople,
        total_people: initialPeople,
        vehicle_plate: vehicle.plate.trim() || null,
        vehicle_brand: vehicle.brand.trim() || null,
        vehicle_model: vehicle.model.trim() || null,
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
    vehicle: { plate: string; brand: string; model: string };
    actualEntryTime: Date;
  }) => {
    if (!selectedRoom || !selectedRoom.room_types) return;

    setStartStayLoading(true);
    const supabase = createClient();

    try {
      const roomType = selectedRoom.room_types;
      const entryTime = data.actualEntryTime;

      // Calcular hora de salida basada en la hora REAL de entrada
      const isWeekend = entryTime.getDay() === 0 || entryTime.getDay() === 6;
      const hours = isWeekend
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
      });

      // Registrar la estancia con la hora REAL de entrada
      const { error: stayError } = await supabase.from("room_stays").insert({
        room_id: selectedRoom.id,
        sales_order_id: salesOrder.id,
        check_in_at: entryTime.toISOString(), // Hora real de entrada
        expected_check_out_at: expectedCheckout.toISOString(),
        current_people: data.initialPeople,
        total_people: data.initialPeople,
        vehicle_plate: data.vehicle.plate.trim() || null,
        vehicle_brand: data.vehicle.brand.trim() || null,
        vehicle_model: data.vehicle.model.trim() || null,
      });

      if (stayError) {
        console.error("Error creating room stay:", stayError);
        toast.error("Error al registrar la estancia");
        return;
      }

      // Actualizar estado de la habitación a OCUPADA
      await supabase
        .from("rooms")
        .update({ status: "OCUPADA" })
        .eq("id", selectedRoom.id);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tablero de Habitaciones</h1>
          <p className="text-muted-foreground text-sm">
            Vista general de todas las habitaciones como tablero físico.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchRooms()}>
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

      {/* Leyenda de estados y tipos */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        {/* Estados */}
        <div className="flex items-center gap-3">
          <span className="text-white/50 font-medium">Estados:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span>Libre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span>Ocupada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-purple-500" />
            <span>Sucia</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            <span>Bloqueada</span>
          </div>
        </div>
        {/* Tipos de habitación */}
        <div className="flex items-center gap-3">
          <span className="text-white/50 font-medium">Tipos:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-slate-500 text-white">SEN</span>
            <span>Sencilla</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-500 text-white">DBL</span>
            <span>Doble</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-pink-500 text-white">JAC</span>
            <span>Jacuzzi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-500 text-white">STE</span>
            <span>Suite</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-cyan-500 text-white">TRE</span>
            <span>Torre</span>
          </div>
        </div>
        {/* Botones de prueba para alertas - ELIMINAR EN PRODUCCIÓN */}
        <div className="ml-auto flex gap-2">
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
      </div>

      {/* Grid único de habitaciones */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {rooms.map((room) => {
              const status = room.status || "OTRO";
              // Verificar si tiene pago pendiente (remaining_amount > 0 en habitación ocupada)
              const activeStay = getActiveStay(room);
              const hasPendingPayment = status === "OCUPADA" &&
                Number(activeStay?.sales_orders?.remaining_amount || 0) > 0;

              return (
                <RoomCard
                  key={room.id}
                  id={room.id}
                  number={room.number}
                  status={status}
                  bgClass={ROOM_STATUS_BG[status] || "bg-slate-900/80"}
                  accentClass={ROOM_STATUS_ACCENT[status] || ""}
                  statusBadge={renderStatusBadge(status)}
                  hasPendingPayment={hasPendingPayment}
                  roomTypeName={room.room_types?.name}
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
        pendingItems={checkoutInfo?.pendingItems}
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
        onAddConsumption={() => {
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
        onQuickCheckin={() => {
          setShowActionsModal(false);
          setShowQuickCheckinModal(true);
        }}
        onEditVehicle={() => {
          setShowActionsModal(false);
          setShowEditVehicleModal(true);
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
        onClose={() => {
          setShowDetailsModal(false);
        }}
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
              const isWeekend = now.getDay() === 0 || now.getDay() === 6;
              const hours = isWeekend ? (roomType?.weekend_hours ?? 4) : (roomType?.weekday_hours ?? 4);
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

            // Actualizar notas de la orden con el motivo del cambio
            const { data: orderData } = await supabase
              .from("sales_orders")
              .select("notes")
              .eq("id", activeStay.sales_order_id)
              .single();

            const newNotes = `${orderData?.notes || ""}\n📝 CAMBIO: Hab. ${selectedRoom.number} → ${newRoom.number} (${data.keepTime ? "tiempo mantenido" : "tiempo reiniciado"}). Motivo: ${data.reason}`;

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
        roomNumber={selectedRoom?.number || ""}
        roomTypeName={selectedRoom?.room_types?.name || ""}
        totalPaid={(() => {
          if (!selectedRoom) return 0;
          const stay = getActiveStay(selectedRoom);
          if (!stay?.sales_orders) return 0;
          const total = Number(stay.sales_orders.remaining_amount) || 0;
          // Total pagado = total - remaining
          return 0; // Por ahora simplificado, se puede mejorar
        })()}
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

            // Actualizar orden de venta
            await supabase
              .from("sales_orders")
              .update({
                status: "CANCELLED",
                notes: `❌ CANCELADA: ${data.reason}. Reembolso: ${data.refundType === "full" ? "Total" : data.refundType === "partial" ? `Parcial $${data.refundAmount}` : "Sin reembolso"}`,
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
    </div>
  );
}
